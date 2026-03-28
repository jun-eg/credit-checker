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
