import {
  ChatSession,
  ChatMessageItem,
  SendMessageResponse,
  ListSessionsResponse,
  ListMessagesResponse,
} from '../../types/chat';

// SSR: BACKEND_URL（サーバー側env var）でバックエンドに直接通信
// クライアント: /api/v1 の相対パス（本番はALBが転送、ローカルはNext.js rewriteがプロキシ）
const backendUrl =
  typeof window === 'undefined'
    ? process.env.BACKEND_URL
    : '/api/v1';

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APIエラー (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function createChatSession(token: string): Promise<ChatSession> {
  return request<ChatSession>('/chat/sessions', token, { method: 'POST', body: '{}' });
}

export async function getChatSessions(token: string): Promise<ChatSession[]> {
  const data = await request<ListSessionsResponse>('/chat/sessions', token);
  return data.sessions;
}

export async function getChatMessages(
  sessionId: string,
  token: string,
): Promise<ChatMessageItem[]> {
  const data = await request<ListMessagesResponse>(
    `/chat/sessions/${sessionId}/messages`,
    token,
  );
  return data.messages;
}

export async function updateChatSession(
  sessionId: string,
  title: string,
  token: string,
): Promise<ChatSession> {
  return request<ChatSession>(`/chat/sessions/${sessionId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function deleteChatSession(
  sessionId: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${backendUrl}/chat/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APIエラー (${res.status}): ${text}`);
  }
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  token: string,
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>(
    `/chat/sessions/${sessionId}/messages`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ message }),
    },
  );
}
