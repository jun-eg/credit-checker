export type ToolName =
  | 'get_total_spending'
  | 'get_spending_by_category'
  | 'get_receipts'
  | 'get_monthly_summary';

export interface GetTotalSpendingArgs {
  from: string;
  to: string;
}

export interface GetSpendingByCategoryArgs {
  from: string;
  to: string;
}

export interface GetReceiptsArgs {
  from: string;
  to: string;
  category?: string;
}

export interface GetMonthlySummaryArgs {
  year: number;
  month: number;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}
