import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { ChatSession } from '../../entities/chat-session.entity';
import { ChatMessage, MessageRole } from '../../entities/chat-message.entity';
import { OpenAiService } from '../openai/openai.service';
import { ChatToolExecutorService } from './chat-tool-executor.service';
import { SPENDING_TOOLS } from './tool-definitions';

// tool_calls を持つ assistant メッセージを識別するマーカー
const TOOL_CALLS_MARKER = '__tool_calls__';

// 無限ループを防ぐためのツール呼び出し上限
const MAX_TOOL_ITERATIONS = 5;

function buildSystemPrompt(): string {
  const now = new Date();
  const year = now.getFullYear();
  // getMonth() は 0-indexed のため +1
  const month = now.getMonth() + 1;
  const day = now.getDate();

  return `あなたは家計管理アシスタントです。ユーザーの支出に関する質問に、\
提供されたツールを使ってデータを取得した上で日本語で回答してください。\
今日の日付は${year}年${month}月${day}日です。「今月」は${year}年${month}月を指します。\
期間の指定がない場合は from と to を省略して全期間を対象としてください。\
金額は日本円で表示し、カテゴリ別の内訳も合わせて提示してください。`;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    private readonly openAiService: OpenAiService,
    private readonly toolExecutor: ChatToolExecutorService,
  ) {}

  async createSession(userId: string): Promise<ChatSession> {
    const session = this.sessionsRepository.create({ userId, title: null });
    return this.sessionsRepository.save(session);
  }

  async getSessions(userId: string): Promise<ChatSession[]> {
    return this.sessionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const session = await this.findSessionOrThrow(sessionId, userId);
    return this.messagesRepository.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
    });
  }

  async sendMessage(
    sessionId: string,
    userId: string,
    userMessage: string,
  ): Promise<string> {
    const session = await this.findSessionOrThrow(sessionId, userId);

    // 過去メッセージを取得してOpenAI用に変換
    const history = await this.messagesRepository.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
    });

    // ユーザーメッセージをDB保存
    await this.messagesRepository.save(
      this.messagesRepository.create({
        sessionId: session.id,
        role: MessageRole.USER,
        content: userMessage,
      }),
    );

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...this.toOpenAiMessages(history),
      { role: 'user', content: userMessage },
    ];

    try {
      return await this.runToolCallingLoop(
        session.id,
        userId,
        messages,
        session,
      );
    } catch (error) {
      this.logger.error(`チャット処理エラー sessionId=${session.id}`, error);
      throw new InternalServerErrorException('回答の生成中にエラーが発生しました');
    }
  }

  private async runToolCallingLoop(
    sessionId: string,
    userId: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    session: ChatSession,
  ): Promise<string> {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const completion = await this.openAiService.chatWithTools(
        messages,
        SPENDING_TOOLS,
      );

      const choice = completion.choices[0];
      if (!choice) {
        throw new Error('OpenAIからレスポンスが返されませんでした');
      }

      const { message } = choice;

      if (choice.finish_reason === 'stop' || !message.tool_calls?.length) {
        const replyText = message.content ?? '';

        // セッションタイトルが未設定なら最初のassistantメッセージから設定
        if (!session.title) {
          session.title = replyText.slice(0, 50);
          await this.sessionsRepository.save(session);
        }

        await this.messagesRepository.save(
          this.messagesRepository.create({
            sessionId,
            role: MessageRole.ASSISTANT,
            content: replyText,
          }),
        );

        return replyText;
      }

      // tool_calls を持つ assistant メッセージをDB保存
      await this.messagesRepository.save(
        this.messagesRepository.create({
          sessionId,
          role: MessageRole.ASSISTANT,
          content: JSON.stringify(message.tool_calls),
          toolName: TOOL_CALLS_MARKER,
        }),
      );

      // ツールを実行
      const toolResults = await this.toolExecutor.execute(
        message.tool_calls,
        userId,
      );

      // tool メッセージをDB保存
      await this.messagesRepository.save(
        toolResults.map((result) => {
          const callId = result.tool_call_id;
          const toolCall = message.tool_calls?.find(
            (c: OpenAI.Chat.ChatCompletionMessageToolCall) => c.id === callId,
          );
          const fnName =
            toolCall?.type === 'function' ? toolCall.function.name : null;
          return this.messagesRepository.create({
            sessionId,
            role: MessageRole.TOOL,
            content: result.content,
            toolCallId: callId,
            toolName: fnName,
          });
        }),
      );

      // 次のループのためにmessages配列を更新
      // SDK レスポンスオブジェクトをそのまま使うと内部状態が残り JSON シリアライズに
      // 失敗することがあるため、structuredClone で plain object に変換してから push する
      // （`function` プロパティへの直接アクセスは組み込み Function 型と名前衝突するため回避）
      const plainToolCalls = structuredClone(message.tool_calls ?? []);
      messages.push(
        { role: 'assistant', content: message.content ?? null, tool_calls: plainToolCalls },
        ...toolResults.map(
          (r): OpenAI.Chat.ChatCompletionToolMessageParam => ({
            role: 'tool',
            content: r.content,
            tool_call_id: r.tool_call_id,
          }),
        ),
      );
    }

    throw new Error(`ツール呼び出しが${MAX_TOOL_ITERATIONS}回を超えました`);
  }

  private toOpenAiMessages(
    messages: ChatMessage[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === MessageRole.USER) {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === MessageRole.ASSISTANT) {
        if (msg.toolName === TOOL_CALLS_MARKER) {
          // tool_calls を持つ assistant メッセージを復元
          const toolCalls = JSON.parse(
            msg.content,
          ) as OpenAI.Chat.ChatCompletionMessageToolCall[];
          result.push({ role: 'assistant', content: null, tool_calls: toolCalls });
        } else {
          result.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === MessageRole.TOOL && msg.toolCallId) {
        result.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId,
        });
      }
    }

    return result;
  }

  private async findSessionOrThrow(
    sessionId: string,
    userId: string,
  ): Promise<ChatSession> {
    const session = await this.sessionsRepository.findOneBy({ id: sessionId });
    if (!session) {
      throw new NotFoundException(`チャットセッションが見つかりません: ${sessionId}`);
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('このセッションへのアクセス権がありません');
    }
    return session;
  }
}
