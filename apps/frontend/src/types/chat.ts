export interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface SendMessageResponse {
  reply: string;
  sessionId: string;
}

export interface ListSessionsResponse {
  sessions: ChatSession[];
}

export interface ListMessagesResponse {
  messages: ChatMessageItem[];
}
