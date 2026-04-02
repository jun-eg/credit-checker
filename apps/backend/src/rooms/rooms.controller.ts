import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { RoomMemberRole } from '../entities/room-member.entity';
import { CreateRoomRequestDto } from './dto/create-room.request.dto';
import { JoinRoomRequestDto } from './dto/join-room.request.dto';
import { RoomDetailResponseDto, RoomResponseDto } from './dto/room.response.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  async createRoom(
    @CurrentUser() user: User,
    @Body() body: CreateRoomRequestDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.createRoom(user.id, body.name);
    return {
      id: room.id,
      name: room.name,
      ownerId: room.ownerId,
      memberCount: 1,
      createdAt: room.createdAt,
    };
  }

  @Get()
  async listRooms(@CurrentUser() user: User): Promise<RoomResponseDto[]> {
    const rooms = await this.roomsService.listRooms(user.id);
    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      ownerId: room.ownerId,
      memberCount: room.members?.length ?? 0,
      createdAt: room.createdAt,
    }));
  }

  // GET /rooms/:id との競合を避けるため /rooms/join を先に定義
  @Post('join')
  async joinRoom(
    @CurrentUser() user: User,
    @Body() body: JoinRoomRequestDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.joinRoom(user.id, body.inviteCode);
    return {
      id: room.id,
      name: room.name,
      ownerId: room.ownerId,
      memberCount: room.members?.length ?? 0,
      createdAt: room.createdAt,
    };
  }

  @Post(':id/invite-code/regenerate')
  async regenerateInviteCode(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ inviteCode: string }> {
    const room = await this.roomsService.regenerateInviteCode(id, user.id);
    return { inviteCode: room.inviteCode };
  }

  @Get(':id')
  async getRoom(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoomDetailResponseDto> {
    const { room, member } = await this.roomsService.getRoom(id, user.id);
    const isOwner = member.role === RoomMemberRole.OWNER;

    return {
      id: room.id,
      name: room.name,
      ownerId: room.ownerId,
      // 招待コードはオーナーにのみ開示する
      inviteCode: isOwner ? room.inviteCode : null,
      members: room.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        displayName: m.user?.displayName ?? null,
        avatarUrl: m.user?.avatarUrl ?? null,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      createdAt: room.createdAt,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteRoom(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.roomsService.deleteRoom(id, user.id);
  }

  @Delete(':id/members/me')
  @HttpCode(204)
  async leaveRoom(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.roomsService.leaveRoom(id, user.id);
  }
}
