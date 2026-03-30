class CategorySummaryDto {
  category: string;
  total: number;
}

export class MonthlySummaryResponseDto {
  year: number;
  month: number;
  total: number;
  currency: string;
  byCategory: CategorySummaryDto[];
}
