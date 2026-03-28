class CategorySummaryDto {
  category: string;
  total: number;
}

class MonthTotalDto {
  month: number;
  total: number;
}

class MonthCategoryTotalDto {
  month: number;
  category: string;
  total: number;
}

export class YearlySummaryResponseDto {
  year: number;
  total: number;
  currency: string;
  byCategory: CategorySummaryDto[];
  byMonth: MonthTotalDto[];
  byMonthCategory: MonthCategoryTotalDto[];
}
