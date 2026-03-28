export class UpdateReceiptItemDto {
  id?: string;
  name?: string;
  category?: string | null;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export class UpdateReceiptRequestDto {
  storeName?: string | null;
  purchasedAt?: string | null;
  total?: number | null;
  currency?: string | null;
  items?: UpdateReceiptItemDto[];
}
