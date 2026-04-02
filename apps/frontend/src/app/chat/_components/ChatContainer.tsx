'use client';

import { useRef } from 'react';
import { SessionSidebar } from './SessionSidebar';
import { MessageThread } from './MessageThread';

interface ChatContainerProps {
  backendToken: string;
  sessionId: string | null;
}

export function ChatContainer({ backendToken, sessionId }: ChatContainerProps) {
  // MessageThread からメッセージ送信完了を受け取り、SessionSidebar のセッション一覧を再取得する
  const refreshSessionsRef = useRef<(() => void) | null>(null);

  const handleSessionsRefresh = (refresh: () => void) => {
    refreshSessionsRef.current = refresh;
  };

  const handleMessageSent = () => {
    refreshSessionsRef.current?.();
  };

  return (
    <>
      <SessionSidebar
        backendToken={backendToken}
        currentSessionId={sessionId}
        onSessionsRefresh={handleSessionsRefresh}
      />
      <MessageThread
        backendToken={backendToken}
        sessionId={sessionId}
        onMessageSent={handleMessageSent}
      />
    </>
  );
}
