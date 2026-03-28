import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import { SpendingToolService } from './spending-tool.service';
import { ToolName, ToolResult } from './types/tool.types';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD形式で指定してください')
  .optional();

const schemas = {
  get_total_spending: z.object({ from: dateSchema, to: dateSchema }),
  get_spending_by_category: z.object({ from: dateSchema, to: dateSchema }),
  get_receipts: z.object({
    from: dateSchema,
    to: dateSchema,
    category: z.string().optional(),
  }),
  get_monthly_summary: z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
  }),
} satisfies Record<ToolName, z.ZodTypeAny>;

@Injectable()
export class ChatToolExecutorService {
  private readonly logger = new Logger(ChatToolExecutorService.name);

  constructor(private readonly spendingToolService: SpendingToolService) {}

  async execute(
    toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
    userId: string,
  ): Promise<ToolResult[]> {
    return Promise.all(
      toolCalls.map((call) => this.executeSingle(call, userId)),
    );
  }

  private async executeSingle(
    call: OpenAI.Chat.ChatCompletionMessageToolCall,
    userId: string,
  ): Promise<ToolResult> {
    // ChatCompletionMessageCustomToolCall は function プロパティを持たないため除外
    if (call.type !== 'function') {
      return {
        tool_call_id: call.id,
        content: JSON.stringify({ error: `未対応のツールタイプ: ${call.type}` }),
      };
    }

    const toolName = call.function.name as ToolName;

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(call.function.arguments);
    } catch {
      return {
        tool_call_id: call.id,
        content: JSON.stringify({ error: '引数のJSONパースに失敗しました' }),
      };
    }

    const schema = schemas[toolName];
    if (!schema) {
      return {
        tool_call_id: call.id,
        content: JSON.stringify({ error: `不明なツール: ${toolName}` }),
      };
    }

    const parsed = schema.safeParse(parsedArgs);
    if (!parsed.success) {
      return {
        tool_call_id: call.id,
        content: JSON.stringify({ error: parsed.error.message }),
      };
    }

    try {
      const result = await this.callTool(toolName, parsed.data, userId);
      return { tool_call_id: call.id, content: JSON.stringify(result) };
    } catch (error) {
      this.logger.error(`ツール実行エラー [${toolName}]: ${String(error)}`);
      return {
        tool_call_id: call.id,
        content: JSON.stringify({ error: 'データの取得中にエラーが発生しました' }),
      };
    }
  }

  private async callTool(
    toolName: ToolName,
    args: z.infer<(typeof schemas)[ToolName]>,
    userId: string,
  ): Promise<unknown> {
    switch (toolName) {
      case 'get_total_spending': {
        const a = args as z.infer<typeof schemas.get_total_spending>;
        return this.spendingToolService.getTotalSpending(userId, a.from, a.to);
      }
      case 'get_spending_by_category': {
        const a = args as z.infer<typeof schemas.get_spending_by_category>;
        return this.spendingToolService.getSpendingByCategory(userId, a.from, a.to);
      }
      case 'get_receipts': {
        const a = args as z.infer<typeof schemas.get_receipts>;
        return this.spendingToolService.getReceipts(userId, a.from, a.to, a.category);
      }
      case 'get_monthly_summary': {
        const a = args as z.infer<typeof schemas.get_monthly_summary>;
        return this.spendingToolService.getMonthlySummary(userId, a.year, a.month);
      }
    }
  }
}
