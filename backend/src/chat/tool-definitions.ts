import OpenAI from 'openai';

const DATE_PARAM = {
  type: 'string' as const,
  description: '日付 (YYYY-MM-DD 形式)',
};

export const SPENDING_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_total_spending',
      description: '指定期間の支出合計金額を取得する',
      parameters: {
        type: 'object',
        properties: {
          from: { ...DATE_PARAM, description: '集計開始日 (YYYY-MM-DD)' },
          to: { ...DATE_PARAM, description: '集計終了日 (YYYY-MM-DD)' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spending_by_category',
      description: '指定期間のカテゴリ別支出を取得する',
      parameters: {
        type: 'object',
        properties: {
          from: { ...DATE_PARAM, description: '集計開始日 (YYYY-MM-DD)' },
          to: { ...DATE_PARAM, description: '集計終了日 (YYYY-MM-DD)' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_receipts',
      description: '指定期間のレシート一覧を取得する',
      parameters: {
        type: 'object',
        properties: {
          from: { ...DATE_PARAM, description: '取得開始日 (YYYY-MM-DD)' },
          to: { ...DATE_PARAM, description: '取得終了日 (YYYY-MM-DD)' },
          category: {
            type: 'string',
            description:
              'カテゴリでフィルタリング（省略可）。指定できる値: 食費、日用品、交通費、外食、医療・薬、衣類・ファッション、娯楽・趣味、電子機器、その他',
          },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_monthly_summary',
      description: '指定月の支出サマリー（合計・カテゴリ別内訳）を取得する',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number', description: '年 (例: 2026)' },
          month: { type: 'number', description: '月 (1〜12)' },
        },
        required: ['year', 'month'],
        additionalProperties: false,
      },
    },
  },
];
