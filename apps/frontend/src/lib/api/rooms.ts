import { Room, RoomDetail, RoomReceiptItem } from '../../types/room';

// SSR: BACKEND_URL（サーバー側env var）でバックエンドに直接通信
// クライアント: /api/v1 の相対パス（本番はALBが転送、ローカルはNext.js rewriteがプロキシ）
const backendUrl =
  typeof window === 'undefined' ? process.env.BACKEND_URL : '/api/v1';

export async function createRoom(name: string, token: string): Promise<Room> {
  const res = await fetch(`${backendUrl}/rooms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ルームの作成に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<Room>;
}

export async function getRooms(token: string): Promise<Room[]> {
  const res = await fetch(`${backendUrl}/rooms`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ルーム一覧の取得に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<Room[]>;
}

export async function getRoom(id: string, token: string): Promise<RoomDetail> {
  const res = await fetch(`${backendUrl}/rooms/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ルームの取得に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<RoomDetail>;
}

export async function joinRoom(inviteCode: string, token: string): Promise<Room> {
  const res = await fetch(`${backendUrl}/rooms/join`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inviteCode }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ルームへの参加に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<Room>;
}

export async function leaveRoom(id: string, token: string): Promise<void> {
  const res = await fetch(`${backendUrl}/rooms/${id}/members/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ルームからの退出に失敗しました (${res.status}): ${text}`);
  }
}

export async function deleteRoom(id: string, token: string): Promise<void> {
  const res = await fetch(`${backendUrl}/rooms/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ルームの削除に失敗しました (${res.status}): ${text}`);
  }
}

export async function listRoomReceipts(
  roomId: string,
  token: string,
): Promise<RoomReceiptItem[]> {
  const res = await fetch(`${backendUrl}/rooms/${roomId}/receipts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ルームのレシート一覧取得に失敗しました (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { items: RoomReceiptItem[] };
  return data.items;
}
