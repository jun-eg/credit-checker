import { RoomMemberResponseDto } from './room-member.response.dto';

export class RoomResponseDto {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  createdAt: Date;
}

export class RoomDetailResponseDto {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string | null;
  inviteCodeExpiresAt: Date | null;
  members: RoomMemberResponseDto[];
  createdAt: Date;
}
