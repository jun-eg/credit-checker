import { AppDataSource } from '../database/data-source';
import { User } from '../entities/user.entity';
import { Receipt, ReceiptStatus } from '../entities/receipt.entity';
import { ReceiptItem } from '../entities/receipt-item.entity';
import { ChatSession } from '../entities/chat-session.entity';
import { ChatMessage, MessageRole } from '../entities/chat-message.entity';

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const receiptRepo = AppDataSource.getRepository(Receipt);
  const itemRepo = AppDataSource.getRepository(ReceiptItem);
  const sessionRepo = AppDataSource.getRepository(ChatSession);
  const messageRepo = AppDataSource.getRepository(ChatMessage);

  const user = userRepo.create({
    email: 'dev@example.com',
    displayName: '開発ユーザー',
    googleId: 'google-dev-123',
  });
  await userRepo.save(user);

  const receipt = receiptRepo.create({
    userId: user.id,
    s3Key: 'dev/receipts/sample-receipt.jpg',
    originalFileName: 'sample-receipt.jpg',
    status: ReceiptStatus.COMPLETED,
    purchasedAt: new Date('2026-03-27T12:00:00Z'),
    storeName: 'サンプルスーパー',
    total: 1580,
    currency: 'JPY',
    gptResponse: {
      storeName: 'サンプルスーパー',
      purchasedAt: '2026-03-27T12:00:00Z',
      total: 1580,
      currency: 'JPY',
      items: [
        { name: '牛乳', quantity: 1, unitPrice: 198, totalPrice: 198, category: '食料品' },
        { name: '食パン', quantity: 1, unitPrice: 198, totalPrice: 198, category: '食料品' },
        { name: '鶏もも肉', quantity: 2, unitPrice: 298, totalPrice: 596, category: '食料品' },
        { name: 'シャンプー', quantity: 1, unitPrice: 388, totalPrice: 388, category: '日用品' },
      ],
    },
  });
  await receiptRepo.save(receipt);

  const items = itemRepo.create([
    {
      receiptId: receipt.id,
      name: '牛乳',
      quantity: 1,
      unitPrice: 198,
      totalPrice: 198,
      category: '食料品',
    },
    {
      receiptId: receipt.id,
      name: '食パン',
      quantity: 1,
      unitPrice: 198,
      totalPrice: 198,
      category: '食料品',
    },
    {
      receiptId: receipt.id,
      name: '鶏もも肉',
      quantity: 2,
      unitPrice: 298,
      totalPrice: 596,
      category: '食料品',
    },
    {
      receiptId: receipt.id,
      name: 'シャンプー',
      quantity: 1,
      unitPrice: 388,
      totalPrice: 388,
      category: '日用品',
    },
  ]);
  await itemRepo.save(items);

  const session = sessionRepo.create({
    userId: user.id,
    title: 'サンプル会話',
  });
  await sessionRepo.save(session);

  const messages = messageRepo.create([
    {
      sessionId: session.id,
      role: MessageRole.USER,
      content: '今月の食費を教えてください',
    },
    {
      sessionId: session.id,
      role: MessageRole.ASSISTANT,
      content: '今月の食費は合計 ¥992 です（牛乳¥198、食パン¥198、鶏もも肉¥596）。',
    },
  ]);
  await messageRepo.save(messages);

  console.log('シードデータの投入が完了しました');
  await AppDataSource.destroy();
}

seed().catch((error: unknown) => {
  console.error('シードエラー:', error);
  process.exit(1);
});
