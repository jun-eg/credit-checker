import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatSession } from './entities/chat-session.entity';
import { Receipt } from './entities/receipt.entity';
import { ReceiptItem } from './entities/receipt-item.entity';
import { User } from './entities/user.entity';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { secrets } from './config/secrets';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          JWT_SECRET: secrets.jwtSecret(),
          OPENAI_API_KEY: secrets.openaiApiKey(),
          DATABASE_SSL: process.env.DATABASE_SSL,
          // DATABASE_URL は TypeOrmModule が secrets.databaseUrl() で直接取得するため登録不要
        }),
      ],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: secrets.databaseUrl(),
        entities: [User, Receipt, ReceiptItem, ChatSession, ChatMessage],
        migrations: ['dist/migrations/*.js'],
        synchronize: false,
        logging: process.env.TYPEORM_LOGGING === 'true',
        // SSL有無はインフラ(app-stack.ts)が DATABASE_SSL で注入する。アプリコードに環境差異を持ち込まない
        ssl: config.get<string>('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ReceiptsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
