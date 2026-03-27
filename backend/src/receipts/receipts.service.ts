import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Receipt, ReceiptStatus } from '../entities/receipt.entity';
import { S3Service } from '../s3/s3.service';
import { extname } from 'path';

interface UploadReceiptParams {
  userId: string;
  file: Express.Multer.File;
}

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptsRepository: Repository<Receipt>,
    private readonly s3Service: S3Service,
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

    return this.receiptsRepository.save(receipt);
  }
}
