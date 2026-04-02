import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSession } from '../../entities/chat-session.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { Receipt } from '../../entities/receipt.entity';
import { ReceiptItem } from '../../entities/receipt-item.entity';
import { OpenAiModule } from '../openai/openai.module';
import { AuthModule } from '../../core/auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SpendingToolService } from './spending-tool.service';
import { ChatToolExecutorService } from './chat-tool-executor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage, Receipt, ReceiptItem]),
    OpenAiModule,
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, SpendingToolService, ChatToolExecutorService],
})
export class ChatModule {}
