import { ReceiptStatus } from '../../entities/receipt.entity';

export class ListReceiptsItemDto {
  id: string;
  status: ReceiptStatus;
  originalFileName: string;
  storeName: string | null;
  purchasedAt: Date | null;
  total: number | null;
  currency: string | null;
  possibleDuplicateIds: string[] | null;
  categories: string[];
  createdAt: Date;
}

export class ListReceiptsResponseDto {
  items: ListReceiptsItemDto[];
}
