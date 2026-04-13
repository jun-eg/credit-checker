import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

// ---- Zod スキーマ ----

const CATEGORIES = [
  '食費',
  '日用品',
  '交通費',
  '外食',
  '医療・薬',
  '衣類・ファッション',
  '娯楽・趣味',
  '電子機器',
  'その他',
] as const;

const ReceiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  total_price: z.number().nonnegative(),
  category: z.enum(CATEGORIES).nullable(),
});

const ReceiptOutputSchema = z.object({
  store_name: z.string().nullable(),
  // ISO 8601 形式の日時文字列。GPT は文字列で返し、呼び出し元で Date に変換する
  purchased_at: z.string().nullable(),
  total: z.number().nonnegative().nullable(),
  currency: z.string().nullable(),
  items: z.array(ReceiptItemSchema),
});

type ReceiptOutput = z.infer<typeof ReceiptOutputSchema>;

// ---- 公開型 ----

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string | null;
}

export interface ReceiptAnalysisResult {
  storeName: string | null;
  purchasedAt: Date | null;
  total: number | null;
  currency: string | null;
  items: ReceiptItem[];
  rawResponse: Record<string, unknown>;
}

// ---- 定数 ----

const MAX_RETRIES = 3;

const ANALYSIS_PROMPT = `
あなたはレシート解析AIです。添付のレシート画像から情報を抽出してください。

カテゴリは以下のリストから最も適切なものを選んでください：
${CATEGORIES.join('、')}

読み取れない項目は null にしてください。
購入日時は ISO 8601 形式（例: 2024-01-15T13:30:00+09:00）で返してください。
`.trim();

// ---- サービス ----

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  async analyzeReceipt(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ReceiptAnalysisResult> {
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}` as const;

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.chat.completions.parse({
          model: 'gpt-4o',
          response_format: zodResponseFormat(ReceiptOutputSchema, 'receipt'),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: ANALYSIS_PROMPT },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl, detail: 'high' },
                },
              ],
            },
          ],
          max_tokens: 2000,
        });

        const rawResponse = response as unknown as Record<string, unknown>;
        const parsed = response.choices[0]?.message?.parsed;

        // Structured Outputs で null になるのは refusal や finish_reason が stop 以外のとき
        if (!parsed) {
          throw new Error(
            `GPTの解析結果が空です (finish_reason: ${response.choices[0]?.finish_reason})`,
          );
        }

        // API レベルで保証されているが、追加の安全策として Zod で再検証する
        const validated = ReceiptOutputSchema.safeParse(parsed);
        if (!validated.success) {
          throw new Error(`Zodバリデーション失敗: ${validated.error.message}`);
        }

        return this.toResult(validated.data, rawResponse);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `レシート解析 attempt ${attempt}/${MAX_RETRIES} 失敗: ${String(error)}`,
        );
        if (attempt < MAX_RETRIES) continue;
      }
    }

    throw lastError;
  }

  async chatWithTools(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.ChatCompletionTool[],
  ): Promise<OpenAI.Chat.ChatCompletion> {
    return this.client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
    });
  }

  private toResult(
    data: ReceiptOutput,
    rawResponse: Record<string, unknown>,
  ): ReceiptAnalysisResult {
    return {
      storeName: data.store_name,
      purchasedAt: data.purchased_at ? new Date(data.purchased_at) : null,
      total: data.total,
      currency: data.currency,
      items: data.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        category: item.category,
      })),
      rawResponse,
    };
  }
}
