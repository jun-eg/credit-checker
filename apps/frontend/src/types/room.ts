import { ReceiptStatus } from './receipt';

export type RoomMemberRole = 'owner' | 'member';

export interface RoomMember {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomMemberRole;
  joinedAt: string;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

export interface RoomDetail {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string | null;
  members: RoomMember[];
  createdAt: string;
}

export interface RoomReceiptItem {
  id: string;
  userId: string;
  uploaderDisplayName: string | null;
  status: ReceiptStatus;
  originalFileName: string;
  storeName: string | null;
  purchasedAt: string | null;
  total: number | null;
  currency: string | null;
  createdAt: string;
}
