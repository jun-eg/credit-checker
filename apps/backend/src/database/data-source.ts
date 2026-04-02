import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Receipt } from '../entities/receipt.entity';
import { ReceiptItem } from '../entities/receipt-item.entity';
import { ChatSession } from '../entities/chat-session.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { Room } from '../entities/room.entity';
import { RoomMember } from '../entities/room-member.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Receipt, ReceiptItem, ChatSession, ChatMessage, Room, RoomMember],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  // RDS はSSL必須。証明書チェーンの検証はスキップ（AWS管理の自己署名CA）
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
