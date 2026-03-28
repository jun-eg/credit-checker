import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Receipt, ReceiptStatus } from '../entities/receipt.entity';
import { ReceiptItem } from '../entities/receipt-item.entity';
import { S3Service } from '../s3/s3.service';
import { OpenAiService } from '../openai/openai.service';
import { extname } from 'path';

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
    const ext = extname(file.originalname).toLowerCase();
    const s3Key = `receipts/${userId}/${uuidv4()}${ext}`;

    await this.s3Service.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
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
    this.analyzeReceipt(saved.id, file.buffer, file.mimetype).catch(
      (error: unknown) => {
        this.logger.error(
          `レシート解析に失敗しました receiptId=${saved.id}`,
          error,
        );
      },
    );

    return saved;
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

  async listReceipts(userId: string): Promise<Receipt[]> {
    return this.receiptsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getMonthlySummary(
    userId: string,
    year: number,
    month: number,
  ): Promise<{ total: number; currency: string; byCategory: { category: string; total: number }[] }> {
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
        .andWhere('receipt.status = :status', { status: ReceiptStatus.COMPLETED })
        .andWhere('receipt.purchased_at >= :from AND receipt.purchased_at < :to', { from, to })
        .getRawOne() as Promise<RawTotal | undefined>,

      this.receiptItemsRepository
        .createQueryBuilder('item')
        .innerJoin('item.receipt', 'receipt')
        .select('item.category', 'category')
        .addSelect('SUM(item.total_price)', 'total')
        .where('receipt.user_id = :userId', { userId })
        .andWhere('receipt.status = :status', { status: ReceiptStatus.COMPLETED })
        .andWhere('receipt.purchased_at >= :from AND receipt.purchased_at < :to', { from, to })
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
