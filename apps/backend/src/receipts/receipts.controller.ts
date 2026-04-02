import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  FileTypeValidator,
  Get,
  Header,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
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
import { UpdateReceiptRequestDto } from './dto/update-receipt.request.dto';
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
    @Body('roomId') roomId?: string,
  ): Promise<UploadReceiptResponseDto> {
    const receipt = await this.receiptsService.uploadReceipt({
      userId: user.id,
      file,
      roomId,
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
    @Query('roomId') roomId?: string,
  ): Promise<ListReceiptsResponseDto> {
    const receipts = await this.receiptsService.listReceipts(user.id, roomId);

    return {
      items: receipts.map((r) => ({
        id: r.id,
        status: r.status,
        originalFileName: r.originalFileName,
        storeName: r.storeName,
        purchasedAt: r.purchasedAt,
        total: r.total,
        currency: r.currency,
        possibleDuplicateIds: r.possibleDuplicateIds ?? null,
        createdAt: r.createdAt,
      })),
    };
  }

  @Get('yearly')
  async getYearlySummary(
    @CurrentUser() user: User,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('roomId') roomId?: string,
  ): Promise<YearlySummaryResponseDto> {
    const summary = await this.receiptsService.getYearlySummary(user.id, year, roomId);

    return {
      year,
      total: summary.total,
      currency: summary.currency,
      byCategory: summary.byCategory,
      byMonth: summary.byMonth,
      byMonthCategory: summary.byMonthCategory,
    };
  }

  @Get('summary')
  async getMonthlySummary(
    @CurrentUser() user: User,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
    @Query('roomId') roomId?: string,
  ): Promise<MonthlySummaryResponseDto> {
    const summary = await this.receiptsService.getMonthlySummary(user.id, year, month, roomId);

    return {
      year,
      month,
      total: summary.total,
      currency: summary.currency,
      byCategory: summary.byCategory,
    };
  }

  @Patch(':id')
  async updateReceipt(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateReceiptRequestDto,
  ): Promise<GetReceiptResponseDto> {
    const receipt = await this.receiptsService.updateReceipt(id, user.id, body);

    return {
      id: receipt.id,
      status: receipt.status,
      originalFileName: receipt.originalFileName,
      storeName: receipt.storeName,
      purchasedAt: receipt.purchasedAt,
      total: receipt.total,
      currency: receipt.currency,
      items: [],
      possibleDuplicateIds: receipt.possibleDuplicateIds ?? null,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteReceipt(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.receiptsService.deleteReceipt(id, user.id);
  }

  @Get(':id/image-url')
  async getReceiptImagePresignedUrl(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ url: string }> {
    const url = await this.receiptsService.getReceiptImagePresignedUrl(id, user.id);
    return { url };
  }

  @Get(':id/image')
  @Header('Cache-Control', 'private, max-age=3600')
  async getReceiptImage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.receiptsService.getReceiptImage(id, user.id);
    return new StreamableFile(buffer, { type: mimeType });
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
      possibleDuplicateIds: receipt.possibleDuplicateIds ?? null,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
    };
  }
}
