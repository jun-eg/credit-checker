export type ReceiptStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface UploadReceiptResponse {
  id: string;
  s3Key: string;
  originalFileName: string;
  status: ReceiptStatus;
  createdAt: string;
}
