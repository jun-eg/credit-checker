import { ReceiptStatus } from '../../entities/receipt.entity';

interface ReceiptItemDto {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string | null;
}

export class GetReceiptResponseDto {
  id: string;
  status: ReceiptStatus;
  originalFileName: string;
  storeName: string | null;
  purchasedAt: Date | null;
  total: number | null;
  currency: string | null;
  items: ReceiptItemDto[];
  possibleDuplicateIds: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}
