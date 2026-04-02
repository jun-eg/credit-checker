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
      {sessionId ? (
        // key でセッション切り替え時に再マウントし状態をリセットする
        <MessageThread
          key={sessionId}
          backendToken={backendToken}
          sessionId={sessionId}
          onMessageSent={handleMessageSent}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            左のサイドバーからチャットを選択するか、新規チャットを開始してください
          </p>
        </div>
      )}
    </>
  );
}
