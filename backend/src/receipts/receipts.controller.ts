import {
  Controller,
  DefaultValuePipe,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { GetReceiptResponseDto } from './dto/get-receipt.response.dto';
import { ListReceiptsResponseDto } from './dto/list-receipts.response.dto';
import { MonthlySummaryResponseDto } from './dto/monthly-summary.response.dto';
import { YearlySummaryResponseDto } from './dto/yearly-summary.response.dto';
import { UploadReceiptResponseDto } from './dto/upload-receipt.response.dto';
import { ReceiptsService } from './receipts.service';

const ACCEPTED_MIME_TYPES = 'image/jpeg|image/png|image/webp';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async upload(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
          new FileTypeValidator({ fileType: ACCEPTED_MIME_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<UploadReceiptResponseDto> {
    const receipt = await this.receiptsService.uploadReceipt({
      userId: user.id,
      file,
    });

    return {
      id: receipt.id,
      s3Key: receipt.s3Key,
      originalFileName: receipt.originalFileName,
      status: receipt.status,
      createdAt: receipt.createdAt,
    };
  }

  @Get()
  async listReceipts(
    @CurrentUser() user: User,
  ): Promise<ListReceiptsResponseDto> {
    const receipts = await this.receiptsService.listReceipts(user.id);

    return {
      items: receipts.map((r) => ({
        id: r.id,
        status: r.status,
        originalFileName: r.originalFileName,
        storeName: r.storeName,
        purchasedAt: r.purchasedAt,
        total: r.total,
        currency: r.currency,
        createdAt: r.createdAt,
      })),
    };
  }

  @Get('yearly')
  async getYearlySummary(
    @CurrentUser() user: User,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
  ): Promise<YearlySummaryResponseDto> {
    const summary = await this.receiptsService.getYearlySummary(user.id, year);

    return {
      year,
      total: summary.total,
      currency: summary.currency,
      byCategory: summary.byCategory,
      byMonth: summary.byMonth,
    };
  }

  @Get('summary')
  async getMonthlySummary(
    @CurrentUser() user: User,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
  ): Promise<MonthlySummaryResponseDto> {
    const summary = await this.receiptsService.getMonthlySummary(user.id, year, month);

    return {
      year,
      month,
      total: summary.total,
      currency: summary.currency,
      byCategory: summary.byCategory,
    };
  }

  @Get(':id')
  async getReceipt(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GetReceiptResponseDto> {
    const receipt = await this.receiptsService.getReceipt(id, user.id);

    return {
      id: receipt.id,
      status: receipt.status,
      originalFileName: receipt.originalFileName,
      storeName: receipt.storeName,
      purchasedAt: receipt.purchasedAt,
      total: receipt.total,
      currency: receipt.currency,
      items: (receipt.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        category: item.category,
      })),
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
    };
  }
}
