import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../../entities/room.entity';
import { RoomMember, RoomMemberRole } from '../../entities/room-member.entity';
import { Receipt } from '../../entities/receipt.entity';
@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly roomMembersRepository: Repository<RoomMember>,
    @InjectRepository(Receipt)
    private readonly receiptsRepository: Repository<Receipt>,
  ) {}

  async createRoom(userId: string, name: string): Promise<Room> {
    const inviteCode = this.generateInviteCode();

    const room = this.roomsRepository.create({ name, ownerId: userId, inviteCode });
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
}
