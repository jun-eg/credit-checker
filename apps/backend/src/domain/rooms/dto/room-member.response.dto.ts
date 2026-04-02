import { RoomMemberRole } from '../../../entities/room-member.entity';

export class RoomMemberResponseDto {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomMemberRole;
  joinedAt: Date;
}
