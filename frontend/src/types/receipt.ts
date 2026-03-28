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
}

export interface ListReceiptItem {
  id: string;
  status: ReceiptStatus;
  originalFileName: string;
  storeName: string | null;
  purchasedAt: string | null;
  total: number | null;
  currency: string | null;
  createdAt: string;
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
