import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { Receipt } from '../entities/receipt.entity';
import { ReceiptItem } from '../entities/receipt-item.entity';
import { RoomMember } from '../entities/room-member.entity';
import { S3Module } from '../s3/s3.module';
import { OpenAiModule } from '../openai/openai.module';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receipt, ReceiptItem, RoomMember]),
    ScheduleModule.forRoot(),
    S3Module,
    OpenAiModule,
    AuthModule,
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule {}
