import { ReceiptStatus } from '../../../entities/receipt.entity';

export class RoomReceiptItemDto {
  id: string;
  userId: string;
  uploaderDisplayName: string | null;
  status: ReceiptStatus;
  originalFileName: string;
  storeName: string | null;
  purchasedAt: Date | null;
  total: number | null;
  currency: string | null;
  createdAt: Date;
}

export class ListRoomReceiptsResponseDto {
  items: RoomReceiptItemDto[];
}
