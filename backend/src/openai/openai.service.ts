import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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

// GPTに返させる構造化JSONの型
interface GptReceiptOutput {
  store_name: string | null;
  purchased_at: string | null;
  total: number | null;
  currency: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    category: string | null;
  }>;
}

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

const ANALYSIS_PROMPT = `
あなたはレシート解析AIです。添付の画像からレシートの情報を抽出し、以下のJSON形式で返してください。

\`\`\`json
{
  "store_name": "店名（不明な場合はnull）",
  "purchased_at": "購入日時（ISO 8601形式、例: 2024-01-15T13:30:00+09:00、不明な場合はnull）",
  "total": 合計金額（数値、不明な場合はnull）,
  "currency": "通貨コード（例: JPY、不明な場合はnull）",
  "items": [
    {
      "name": "商品名",
      "quantity": 数量（整数）,
      "unit_price": 単価（数値）,
      "total_price": 小計（数値）,
      "category": "カテゴリ（後述の固定リストから選択、不明な場合はnull）"
    }
  ]
}
\`\`\`

カテゴリは以下のリストから最も適切なものを選んでください：
${CATEGORIES.join('、')}

注意事項：
- JSONのみを返してください（コードブロックや説明文は不要）
- 金額はすべて数値（文字列ではない）で返してください
- 読み取れない項目はnullにしてください
`.trim();

@Injectable()
export class OpenAiService {
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

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const rawResponse = response as unknown as Record<string, unknown>;
    const content = response.choices[0]?.message?.content ?? '';
    const parsed = this.parseGptOutput(content);

    return {
      storeName: parsed.store_name ?? null,
      purchasedAt: parsed.purchased_at ? new Date(parsed.purchased_at) : null,
      total: parsed.total ?? null,
      currency: parsed.currency ?? null,
      items: (parsed.items ?? []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        category: item.category ?? null,
      })),
      rawResponse,
    };
  }

  private parseGptOutput(content: string): Partial<GptReceiptOutput> {
    try {
      // コードブロックが含まれる場合は除去する
      const cleaned = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      return JSON.parse(cleaned) as GptReceiptOutput;
    } catch {
      // JSON解析に失敗した場合は空オブジェクトを返し、呼び出し元でハンドリングする
      return {};
    }
  }
}
