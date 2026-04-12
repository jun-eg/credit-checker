import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ReceiptItem } from './receipt-item.entity';
import { Room } from './room.entity';

export enum ReceiptStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 's3_key' })
  s3Key: string;

  @Column({ name: 'original_file_name' })
  originalFileName: string;

  @Column({
    type: 'enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.PENDING,
  })
  status: ReceiptStatus;

  @Column({ name: 'purchased_at', type: 'timestamptz', nullable: true })
  purchasedAt: Date | null;

  @Column({ name: 'store_name', type: 'varchar', nullable: true })
  storeName: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  total: number | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  @Column({ name: 'gpt_response', type: 'jsonb', nullable: true })
  gptResponse: Record<string, unknown> | null;

  @Column({ name: 'possible_duplicate_ids', type: 'jsonb', nullable: true })
  possibleDuplicateIds: string[] | null;

  @Column({ name: 'room_id', nullable: true })
  roomId: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.receipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => ReceiptItem, (item: ReceiptItem) => item.receipt, {
    cascade: true,
  })
  items: ReceiptItem[];

  @ManyToOne(() => Room, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'room_id' })
  room: Room | null;
}
