import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from './user.entity';

@Entity('room_invitations')
export class RoomInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_by', type: 'uuid', nullable: true })
  usedBy: string | null;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'used_by' })
  usedByUser: User | null;
}
