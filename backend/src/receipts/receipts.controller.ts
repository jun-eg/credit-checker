import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
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
}
