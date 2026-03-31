import { ReceiptStatus } from '../../entities/receipt.entity';

export class UploadReceiptResponseDto {
  id: string;
  s3Key: string;
  originalFileName: string;
  status: ReceiptStatus;
  createdAt: Date;
}
