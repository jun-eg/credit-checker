import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomMember, RoomMemberRole } from '../entities/room-member.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly roomMembersRepository: Repository<RoomMember>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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

  private generateInviteCode(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  }
}
