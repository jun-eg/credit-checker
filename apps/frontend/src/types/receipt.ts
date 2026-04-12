export type ReceiptStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface UploadReceiptResponse {
  id: string;
  s3Key: string;
  originalFileName: string;
  status: ReceiptStatus;
  createdAt: string;
}

export interface GetReceiptResponse {
  id: string;
  status: ReceiptStatus;
  originalFileName: string;
  storeName: string | null;
  total: number | null;
  currency: string | null;
  possibleDuplicateIds: string[] | null;
}

export interface UpdateReceiptItemRequest {
  id?: string;
  name?: string;
  category?: string | null;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface UpdateReceiptRequest {
  storeName?: string | null;
  purchasedAt?: string | null;
  total?: number | null;
  currency?: string | null;
  items?: UpdateReceiptItemRequest[];
}

export interface ListReceiptItem {
  id: string;
  status: ReceiptStatus;
  originalFileName: string;
  storeName: string | null;
  purchasedAt: string | null;
  total: number | null;
  currency: string | null;
  possibleDuplicateIds: string[] | null;
  categories: string[];
  createdAt: string;
  deletedAt?: string | null;
}

export interface ListReceiptsResponse {
  items: ListReceiptItem[];
}

export interface ReceiptItemDetail {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string | null;
}

export interface GetReceiptDetailResponse {
  id: string;
  status: ReceiptStatus;
  originalFileName: string;
  storeName: string | null;
  purchasedAt: string | null;
  total: number | null;
  currency: string | null;
  items: ReceiptItemDetail[];
  possibleDuplicateIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategorySummary {
  category: string;
  total: number;
}

export interface MonthlySummaryResponse {
  year: number;
  month: number;
  total: number;
  currency: string;
  byCategory: CategorySummary[];
}

export interface MonthTotal {
  month: number;
  total: number;
}

export interface MonthCategoryTotal {
  month: number;
  category: string;
  total: number;
}

export interface YearlySummaryResponse {
  year: number;
  total: number;
  currency: string;
  byCategory: CategorySummary[];
  byMonth: MonthTotal[];
  byMonthCategory: MonthCategoryTotal[];
}
