import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt, ReceiptStatus } from '../entities/receipt.entity';
import { ReceiptItem } from '../entities/receipt-item.entity';

interface SpendingTotal {
  total: number;
  currency: string;
}

interface CategorySpending {
  category: string;
  total: number;
}

export interface ReceiptSummary {
  id: string;
  storeName: string | null;
  purchasedAt: Date | null;
  total: number | null;
  currency: string | null;
}

export interface MonthlySummary {
  total: number;
  currency: string;
  byCategory: CategorySpending[];
}

type RawTotal = { total: string };
type RawCategoryTotal = { category: string | null; total: string };

// 全期間を表すデフォルト値
const ALL_TIME_FROM = '2000-01-01';
const ALL_TIME_TO = '2099-12-31';

@Injectable()
export class SpendingToolService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptsRepository: Repository<Receipt>,
    @InjectRepository(ReceiptItem)
    private readonly receiptItemsRepository: Repository<ReceiptItem>,
  ) {}

  async getTotalSpending(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<SpendingTotal> {
    const f = from ?? ALL_TIME_FROM;
    const t = to ?? ALL_TIME_TO;
    const result = (await this.receiptsRepository
      .createQueryBuilder('receipt')
      .select('COALESCE(SUM(receipt.total), 0)', 'total')
      .where('receipt.user_id = :userId', { userId })
      .andWhere('receipt.status = :status', { status: ReceiptStatus.COMPLETED })
      .andWhere('receipt.purchased_at BETWEEN :from AND :to', {
        from: f,
        to: `${t} 23:59:59`,
      })
      .getRawOne()) as RawTotal | undefined;

    return {
      total: Number(result?.total ?? 0),
      currency: 'JPY',
    };
  }

  async getSpendingByCategory(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<CategorySpending[]> {
    const f = from ?? ALL_TIME_FROM;
    const t = to ?? ALL_TIME_TO;
    const rows = (await this.receiptItemsRepository
      .createQueryBuilder('item')
      .innerJoin('item.receipt', 'receipt')
      .select('item.category', 'category')
      .addSelect('SUM(item.total_price)', 'total')
      .where('receipt.user_id = :userId', { userId })
      .andWhere('receipt.status = :status', { status: ReceiptStatus.COMPLETED })
      .andWhere('receipt.purchased_at BETWEEN :from AND :to', {
        from: f,
        to: `${t} 23:59:59`,
      })
      .groupBy('item.category')
      .orderBy('total', 'DESC')
      .getRawMany()) as RawCategoryTotal[];

    return rows.map((row) => ({
      category: row.category ?? 'その他',
      total: Number(row.total),
    }));
  }

  async getReceipts(
    userId: string,
    from?: string,
    to?: string,
    category?: string,
  ): Promise<ReceiptSummary[]> {
    const f = from ?? ALL_TIME_FROM;
    const t = to ?? ALL_TIME_TO;
    const qb = this.receiptsRepository
      .createQueryBuilder('receipt')
      .select([
        'receipt.id',
        'receipt.storeName',
        'receipt.purchasedAt',
        'receipt.total',
        'receipt.currency',
      ])
      .where('receipt.user_id = :userId', { userId })
      .andWhere('receipt.status = :status', { status: ReceiptStatus.COMPLETED })
      .andWhere('receipt.purchased_at BETWEEN :from AND :to', {
        from: f,
        to: `${t} 23:59:59`,
      });

    if (category) {
      qb.innerJoin('receipt.items', 'item').andWhere(
        'item.category = :category',
        { category },
      );
    }

    const receipts = await qb
      .orderBy('receipt.purchased_at', 'DESC')
      .getMany();

    return receipts.map((r: Receipt) => ({
      id: r.id,
      storeName: r.storeName,
      purchasedAt: r.purchasedAt,
      total: r.total,
      currency: r.currency,
    }));
  }

  async getMonthlySummary(
    userId: string,
    year: number,
    month: number,
  ): Promise<MonthlySummary> {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const to = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const [totalResult, byCategory] = await Promise.all([
      this.receiptsRepository
        .createQueryBuilder('receipt')
        .select('COALESCE(SUM(receipt.total), 0)', 'total')
        .where('receipt.user_id = :userId', { userId })
        .andWhere('receipt.status = :status', {
          status: ReceiptStatus.COMPLETED,
        })
        .andWhere(
          'receipt.purchased_at >= :from AND receipt.purchased_at < :to',
          { from, to },
        )
        .getRawOne() as Promise<RawTotal | undefined>,

      this.receiptItemsRepository
        .createQueryBuilder('item')
        .innerJoin('item.receipt', 'receipt')
        .select('item.category', 'category')
        .addSelect('SUM(item.total_price)', 'total')
        .where('receipt.user_id = :userId', { userId })
        .andWhere('receipt.status = :status', {
          status: ReceiptStatus.COMPLETED,
        })
        .andWhere(
          'receipt.purchased_at >= :from AND receipt.purchased_at < :to',
          { from, to },
        )
        .groupBy('item.category')
        .orderBy('total', 'DESC')
        .getRawMany() as Promise<RawCategoryTotal[]>,
    ]);

    return {
      total: Number(totalResult?.total ?? 0),
      currency: 'JPY',
      byCategory: byCategory.map((row) => ({
        category: row.category ?? 'その他',
        total: Number(row.total),
      })),
    };
  }
}
