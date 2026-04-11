import {
  AcceptInvitationError,
  AcceptInvitationErrorCode,
  Room,
  RoomDetail,
  RoomInvitation,
  RoomReceiptItem,
} from '../../types/room';

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

export async function issueRoomInvitation(
  roomId: string,
  backendToken: string,
): Promise<RoomInvitation> {
  const res = await fetch(`${backendUrl}/rooms/${roomId}/invitations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${backendToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`招待リンクの発行に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<RoomInvitation>;
}

// エラー種別をサーバー応答のステータスコードから判別する
function resolveAcceptInvitationError(
  status: number,
  body: string,
): AcceptInvitationError {
  const codeByStatus: Record<number, AcceptInvitationErrorCode> = {
    401: 'unauthorized',
    404: 'not_found',
    410: 'expired',
  };
  let code: AcceptInvitationErrorCode = codeByStatus[status] ?? 'unknown';
  // 409 は「使用済み」と「既メンバー」のいずれか。サーバーメッセージで判別する
  if (status === 409) {
    code = /既に.*メンバー/.test(body) ? 'already_member' : 'already_used';
  }
  const messageByCode: Record<AcceptInvitationErrorCode, string> = {
    not_found: '招待リンクが無効です',
    expired: '招待リンクの有効期限が切れています',
    already_used: 'この招待リンクは既に使用されています',
    already_member: 'すでにこのルームのメンバーです',
    unauthorized: 'ログインが必要です',
    unknown: `招待リンクの受諾に失敗しました (${status})`,
  };
  return new AcceptInvitationError(code, messageByCode[code]);
}

export async function acceptRoomInvitation(
  invitationToken: string,
  backendToken: string,
): Promise<Room> {
  const res = await fetch(
    `${backendUrl}/rooms/invitations/${encodeURIComponent(invitationToken)}/accept`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${backendToken}` },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw resolveAcceptInvitationError(res.status, text);
  }

  return res.json() as Promise<Room>;
}
