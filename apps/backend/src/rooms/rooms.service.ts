import { randomBytes } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomMember, RoomMemberRole } from '../entities/room-member.entity';
import { RoomInvitation } from '../entities/room-invitation.entity';
import { Receipt } from '../entities/receipt.entity';

// 招待リンクは発行から30分で失効する
const INVITATION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly roomMembersRepository: Repository<RoomMember>,
    @InjectRepository(RoomInvitation)
    private readonly roomInvitationsRepository: Repository<RoomInvitation>,
    @InjectRepository(Receipt)
    private readonly receiptsRepository: Repository<Receipt>,
  ) {}

  async createRoom(userId: string, name: string): Promise<Room> {
    const inviteCode = this.generateInviteCode();
    const inviteCodeExpiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const room = this.roomsRepository.create({ name, ownerId: userId, inviteCode, inviteCodeExpiresAt });
    const saved = await this.roomsRepository.save(room);

    const member = this.roomMembersRepository.create({
      roomId: saved.id,
      userId,
      role: RoomMemberRole.OWNER,
    });
    await this.roomMembersRepository.save(member);

    return saved;
  }

  async listRooms(userId: string): Promise<Room[]> {
    return this.roomsRepository
      .createQueryBuilder('room')
      .innerJoin('room.members', 'member')
      .where('member.user_id = :userId', { userId })
      .orderBy('room.created_at', 'DESC')
      .getMany();
  }

  async getRoom(
    roomId: string,
    userId: string,
  ): Promise<{ room: Room; member: RoomMember }> {
    const member = await this.roomMembersRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) {
      throw new NotFoundException(`ルームが見つかりません: ${roomId}`);
    }

    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['members', 'members.user'],
    });
    if (!room) {
      throw new NotFoundException(`ルームが見つかりません: ${roomId}`);
    }

    return { room, member };
  }

  async deleteRoom(roomId: string, userId: string): Promise<void> {
    const member = await this.roomMembersRepository.findOne({
      where: { roomId, userId },
    });
    // オーナー以外はルームを解散できない
    if (!member || member.role !== RoomMemberRole.OWNER) {
      throw new ForbiddenException('ルームの解散はオーナーのみ可能です');
    }

    const room = await this.roomsRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException(`ルームが見つかりません: ${roomId}`);
    }
    await this.roomsRepository.remove(room);
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const member = await this.roomMembersRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) {
      throw new NotFoundException(`ルームが見つかりません: ${roomId}`);
    }
    // オーナーが退出するとルームが宙に浮くため禁止
    if (member.role === RoomMemberRole.OWNER) {
      throw new ForbiddenException(
        'オーナーはルームを退出できません。ルームを解散してください',
      );
    }

    await this.roomMembersRepository.remove(member);
  }

  async joinRoom(userId: string, inviteCode: string): Promise<Room> {
    const room = await this.roomsRepository.findOne({ where: { inviteCode } });
    if (!room) {
      throw new NotFoundException('招待コードが無効です');
    }

    if (room.inviteCodeExpiresAt.getTime() <= Date.now()) {
      throw new GoneException('招待コードの有効期限が切れています');
    }

    const existing = await this.roomMembersRepository.findOne({
      where: { roomId: room.id, userId },
    });
    if (existing) {
      throw new ConflictException('既にこのルームのメンバーです');
    }

    const member = this.roomMembersRepository.create({
      roomId: room.id,
      userId,
      role: RoomMemberRole.MEMBER,
    });
    await this.roomMembersRepository.save(member);

    return room;
  }

  async regenerateInviteCode(roomId: string, userId: string): Promise<Room> {
    const member = await this.roomMembersRepository.findOne({
      where: { roomId, userId },
    });
    // 招待コード再生成はオーナーのみ許可
    if (!member || member.role !== RoomMemberRole.OWNER) {
      throw new ForbiddenException('招待コードの再生成はオーナーのみ可能です');
    }

    const room = await this.roomsRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException(`ルームが見つかりません: ${roomId}`);
    }

    room.inviteCode = this.generateInviteCode();
    room.inviteCodeExpiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    return this.roomsRepository.save(room);
  }

  async listRoomReceipts(roomId: string, userId: string): Promise<Receipt[]> {
    // メンバー確認
    const member = await this.roomMembersRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) {
      throw new NotFoundException(`ルームが見つかりません: ${roomId}`);
    }

    // ルームに紐づく全メンバーのレシートをuserと一緒に取得
    return this.receiptsRepository
      .createQueryBuilder('receipt')
      .innerJoinAndSelect('receipt.user', 'user')
      .where('receipt.room_id = :roomId', { roomId })
      .orderBy('receipt.created_at', 'DESC')
      .getMany();
  }

  private generateInviteCode(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  }

  async issueInvitation(
    roomId: string,
    userId: string,
  ): Promise<{ invitation: RoomInvitation; url: string }> {
    const member = await this.roomMembersRepository.findOne({
      where: { roomId, userId },
    });
    // 招待リンク発行はオーナーのみ許可
    if (!member || member.role !== RoomMemberRole.OWNER) {
      throw new ForbiddenException('招待リンクの発行はオーナーのみ可能です');
    }

    const room = await this.roomsRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException(`ルームが見つかりません: ${roomId}`);
    }

    const token = this.generateInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = this.roomInvitationsRepository.create({
      roomId,
      token,
      createdBy: userId,
      expiresAt,
      usedBy: null,
      usedAt: null,
    });
    const saved = await this.roomInvitationsRepository.save(invitation);

    return { invitation: saved, url: this.buildInvitationUrl(token) };
  }

  async acceptInvitation(token: string, userId: string): Promise<Room> {
    return this.roomInvitationsRepository.manager.transaction(async (manager) => {
      // 同時に同じトークンを使おうとするリクエストを直列化するため、行ロックで読む
      const invitation = await manager
        .getRepository(RoomInvitation)
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.token = :token', { token })
        .getOne();

      if (!invitation) {
        throw new NotFoundException('招待リンクが見つかりません');
      }
      if (invitation.expiresAt.getTime() <= Date.now()) {
        throw new GoneException('招待リンクの有効期限が切れています');
      }
      if (invitation.usedBy) {
        throw new ConflictException('この招待リンクは既に使用されています');
      }

      const existing = await manager.getRepository(RoomMember).findOne({
        where: { roomId: invitation.roomId, userId },
      });
      // 既メンバーの場合は招待リンクを消費せず、冪等的にエラーとする
      if (existing) {
        throw new ConflictException('既にこのルームのメンバーです');
      }

      invitation.usedBy = userId;
      invitation.usedAt = new Date();
      await manager.getRepository(RoomInvitation).save(invitation);

      const newMember = manager.getRepository(RoomMember).create({
        roomId: invitation.roomId,
        userId,
        role: RoomMemberRole.MEMBER,
      });
      await manager.getRepository(RoomMember).save(newMember);

      const room = await manager
        .getRepository(Room)
        .findOne({ where: { id: invitation.roomId } });
      if (!room) {
        throw new NotFoundException('ルームが見つかりません');
      }
      return room;
    });
  }

  // URL-safe base64 で 256bit のランダムトークンを生成する（43文字）
  private generateInvitationToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private buildInvitationUrl(token: string): string {
    const base = process.env.FRONTEND_URL ?? '';
    // 末尾スラッシュの重複を避ける
    const normalized = base.replace(/\/$/, '');
    return `${normalized}/rooms/join?token=${token}`;
  }
}
