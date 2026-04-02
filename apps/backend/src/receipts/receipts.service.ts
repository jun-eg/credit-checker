import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { Receipt, ReceiptStatus } from '../entities/receipt.entity';
import { ReceiptItem } from '../entities/receipt-item.entity';
import { S3Service } from '../s3/s3.service';
import { OpenAiService } from '../openai/openai.service';

interface UploadReceiptParams {
  userId: string;
  file: Express.Multer.File;
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptsRepository: Repository<Receipt>,
    @InjectRepository(ReceiptItem)
    private readonly receiptItemsRepository: Repository<ReceiptItem>,
    private readonly s3Service: S3Service,
    private readonly openAiService: OpenAiService,
  ) {}

  async uploadReceipt({ userId, file }: UploadReceiptParams): Promise<Receipt> {
    // S3コスト・転送コスト削減のためWebP変換・リサイズ
    const { buffer: convertedBuffer, mimeType: convertedMimeType } =
      await this.convertToWebP(file.buffer);

    const s3Key = `receipts/${userId}/${uuidv4()}.webp`;

    await this.s3Service.upload({
      buffer: convertedBuffer,
      mimeType: convertedMimeType,
      s3Key,
    });

    const receipt = this.receiptsRepository.create({
      userId,
      s3Key,
      originalFileName: file.originalname,
      status: ReceiptStatus.PENDING,
    });

    const saved = await this.receiptsRepository.save(receipt);

    // アップロード完了後、非同期でVision解析を実行（fire-and-forget）
    // 変換後バッファを渡すことでVision APIのトークンコストも削減
    this.analyzeReceipt(saved.id, convertedBuffer, convertedMimeType).catch(
      (error: unknown) => {
        this.logger.error(
          `レシート解析に失敗しました receiptId=${saved.id}`,
          error,
        );
      },
    );

    return saved;
  }

  private async convertToWebP(
    buffer: Buffer,
  ): Promise<{ buffer: Buffer; mimeType: 'image/webp' }> {
    const converted = await sharp(buffer)
      .resize(1600, 1600, {
        fit: 'inside',            // 縦横比を保持・見切れなし
        withoutEnlargement: true, // 元画像より大きくしない
      })
      .webp({ quality: 85 })
      .toBuffer();
    return { buffer: converted, mimeType: 'image/webp' };
  }

  async analyzeReceipt(
    receiptId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    const receipt = await this.receiptsRepository.findOneBy({ id: receiptId });
    if (!receipt) {
      throw new NotFoundException(`レシートが見つかりません: ${receiptId}`);
    }

    receipt.status = ReceiptStatus.PROCESSING;
    await this.receiptsRepository.save(receipt);

    try {
      const result = await this.openAiService.analyzeReceipt(
        imageBuffer,
        mimeType,
      );

      receipt.status = ReceiptStatus.COMPLETED;
      receipt.storeName = result.storeName;
      receipt.purchasedAt = result.purchasedAt;
      receipt.total = result.total;
      receipt.currency = result.currency;
      receipt.gptResponse = result.rawResponse;
      await this.receiptsRepository.save(receipt);

      await this.detectDuplicates(receipt);

      if (result.items.length > 0) {
        const items = result.items.map((item) =>
          this.receiptItemsRepository.create({
            receiptId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            category: item.category,
          }),
        );
        await this.receiptItemsRepository.save(items);
      }
    } catch (error) {
      this.logger.error(
        `GPT Vision解析でエラーが発生しました receiptId=${receiptId}`,
        error,
      );
      receipt.status = ReceiptStatus.FAILED;
      await this.receiptsRepository.save(receipt);
    }
  }

  async getReceipt(receiptId: string, userId: string): Promise<Receipt> {
    const receipt = await this.receiptsRepository.findOne({
      where: { id: receiptId, userId },
      relations: ['items'],
    });
    if (!receipt) {
      throw new NotFoundException(`レシートが見つかりません: ${receiptId}`);
    }
    return receipt;
  }

  async updateReceipt(
    receiptId: string,
    userId: string,
    data: {
      storeName?: string | null;
      purchasedAt?: string | null;
      total?: number | null;
      currency?: string | null;
      items?: {
        id?: string;
        name?: string;
        category?: string | null;
        quantity?: number;
        unitPrice?: number;
        totalPrice?: number;
      }[];
    },
  ): Promise<Receipt> {
    const receipt = await this.receiptsRepository.findOneBy({
      id: receiptId,
      userId,
    });
    if (!receipt) {
      throw new NotFoundException(`レシートが見つかりません: ${receiptId}`);
    }

    if (data.storeName !== undefined) receipt.storeName = data.storeName;
    if (data.purchasedAt !== undefined) {
      receipt.purchasedAt = data.purchasedAt
        ? new Date(data.purchasedAt)
        : null;
    }
    if (data.total !== undefined) receipt.total = data.total;
    if (data.currency !== undefined) receipt.currency = data.currency;

    await this.receiptsRepository.save(receipt);

    if (data.items !== undefined) {
      const existingItems = await this.receiptItemsRepository.findBy({
        receiptId,
      });
      const incomingIds = new Set(
        data.items.map((i) => i.id).filter((id): id is string => !!id),
      );

      // idが送られていない既存アイテムを削除
      const toDelete = existingItems.filter((e) => !incomingIds.has(e.id));
      if (toDelete.length > 0) {
        await this.receiptItemsRepository.remove(toDelete);
      }

      for (const itemData of data.items) {
        if (itemData.id) {
          // 既存アイテムの更新
          const item = existingItems.find((e) => e.id === itemData.id);
          if (!item) continue;
          if (itemData.name !== undefined) item.name = itemData.name;
          if (itemData.category !== undefined)
            item.category = itemData.category;
          if (itemData.quantity !== undefined)
            item.quantity = itemData.quantity;
          if (itemData.unitPrice !== undefined)
            item.unitPrice = itemData.unitPrice;
          if (itemData.totalPrice !== undefined)
            item.totalPrice = itemData.totalPrice;
          await this.receiptItemsRepository.save(item);
        } else {
          // 新規アイテムの作成
          const newItem = this.receiptItemsRepository.create({
            receiptId,
            name: itemData.name ?? '新規商品',
            category: itemData.category ?? null,
            quantity: itemData.quantity ?? 1,
            unitPrice: itemData.unitPrice ?? 0,
            totalPrice: itemData.totalPrice ?? 0,
          });
          await this.receiptItemsRepository.save(newItem);
        }
      }
    }

    return this.receiptsRepository.findOne({
      where: { id: receiptId },
      relations: ['items'],
    }) as Promise<Receipt>;
  }

  async deleteReceipt(receiptId: string, userId: string): Promise<void> {
    const receipt = await this.receiptsRepository.findOneBy({
      id: receiptId,
      userId,
    });
    if (!receipt) {
      throw new NotFoundException(`レシートが見つかりません: ${receiptId}`);
    }
    await this.receiptsRepository.remove(receipt);
  }

  private async detectDuplicates(receipt: Receipt): Promise<void> {
    // 日付か合計のどちらも取れていない場合は比較不可
    if (!receipt.purchasedAt && receipt.total === null) return;

    const qb = this.receiptsRepository
      .createQueryBuilder('r')
      .select('r.id', 'id')
      .where('r.user_id = :userId', { userId: receipt.userId })
      .andWhere('r.id != :id', { id: receipt.id })
      .andWhere('r.status = :status', { status: ReceiptStatus.COMPLETED });

    if (receipt.purchasedAt) {
      qb.andWhere('DATE(r.purchased_at) = DATE(:purchasedAt)', {
        purchasedAt: receipt.purchasedAt,
      });
    }

    if (receipt.total !== null) {
      qb.andWhere('ABS(r.total - :total) < 1', { total: receipt.total });
    }

    if (receipt.storeName) {
      qb.andWhere('LOWER(TRIM(r.store_name)) = LOWER(TRIM(:storeName))', {
        storeName: receipt.storeName,
      });
    }

    const rows = await qb.getRawMany<{ id: string }>();
    receipt.possibleDuplicateIds =
      rows.length > 0 ? rows.map((r) => r.id) : null;
    await this.receiptsRepository.save(receipt);
  }

  async getReceiptImage(
    receiptId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const receipt = await this.receiptsRepository.findOneBy({
      id: receiptId,
      userId,
    });
    if (!receipt) {
      throw new NotFoundException(`レシートが見つかりません: ${receiptId}`);
    }

    const ext = receipt.s3Key.split('.').pop()?.toLowerCase() ?? '';
    const mimeType =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : 'application/octet-stream';

    const buffer = await this.s3Service.getObject(receipt.s3Key);
    return { buffer, mimeType };
  }

  async getReceiptImagePresignedUrl(receiptId: string, userId: string): Promise<string> {
    const receipt = await this.receiptsRepository.findOneBy({ id: receiptId, userId });
    if (!receipt) {
      throw new NotFoundException(`レシートが見つかりません: ${receiptId}`);
    }
    return this.s3Service.getPresignedUrl(receipt.s3Key);
  }

  async listReceipts(userId: string): Promise<Receipt[]> {
    return this.receiptsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getYearlySummary(
    userId: string,
    year: number,
  ): Promise<{
    total: number;
    currency: string;
    byCategory: { category: string; total: number }[];
    byMonth: { month: number; total: number }[];
    byMonthCategory: { month: number; category: string; total: number }[];
  }> {
    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;

    type RawTotal = { total: string };
    type RawCategoryTotal = { category: string | null; total: string };
    type RawMonthTotal = { month: string; total: string };
    type RawMonthCategoryTotal = {
      month: string;
      category: string | null;
      total: string;
    };

    const [totalResult, byCategory, byMonth, byMonthCategory] =
      await Promise.all([
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
          .getRawOne<RawTotal>(),

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
          .getRawMany<RawCategoryTotal>(),

        this.receiptsRepository
          .createQueryBuilder('receipt')
          .select('EXTRACT(MONTH FROM receipt.purchased_at)', 'month')
          .addSelect('COALESCE(SUM(receipt.total), 0)', 'total')
          .where('receipt.user_id = :userId', { userId })
          .andWhere('receipt.status = :status', {
            status: ReceiptStatus.COMPLETED,
          })
          .andWhere(
            'receipt.purchased_at >= :from AND receipt.purchased_at < :to',
            { from, to },
          )
          .groupBy('month')
          .orderBy('month', 'ASC')
          .getRawMany<RawMonthTotal>(),

        this.receiptItemsRepository
          .createQueryBuilder('item')
          .innerJoin('item.receipt', 'receipt')
          .select('EXTRACT(MONTH FROM receipt.purchased_at)', 'month')
          .addSelect('item.category', 'category')
          .addSelect('SUM(item.total_price)', 'total')
          .where('receipt.user_id = :userId', { userId })
          .andWhere('receipt.status = :status', {
            status: ReceiptStatus.COMPLETED,
          })
          .andWhere(
            'receipt.purchased_at >= :from AND receipt.purchased_at < :to',
            { from, to },
          )
          .groupBy('month')
          .addGroupBy('item.category')
          .orderBy('month', 'ASC')
          .getRawMany<RawMonthCategoryTotal>(),
      ]);

    // 1〜12月すべてのエントリを返す（データなし月は0）
    const monthMap = new Map(
      byMonth.map((r) => [Number(r.month), Number(r.total)]),
    );
    const allMonths = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: monthMap.get(i + 1) ?? 0,
    }));

    return {
      total: Number(totalResult?.total ?? 0),
      currency: 'JPY',
      byCategory: byCategory.map((row) => ({
        category: row.category ?? 'その他',
        total: Number(row.total),
      })),
      byMonth: allMonths,
      byMonthCategory: byMonthCategory.map((row) => ({
        month: Number(row.month),
        category: row.category ?? 'その他',
        total: Number(row.total),
      })),
    };
  }

  async getMonthlySummary(
    userId: string,
    year: number,
    month: number,
  ): Promise<{
    total: number;
    currency: string;
    byCategory: { category: string; total: number }[];
  }> {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const to = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    type RawTotal = { total: string };
    type RawCategoryTotal = { category: string | null; total: string };

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
        .getRawOne<RawTotal>(),

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
        .getRawMany<RawCategoryTotal>(),
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
