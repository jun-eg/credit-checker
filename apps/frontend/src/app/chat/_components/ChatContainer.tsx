'use client';

import { useRef, useState } from 'react';
import { SessionSidebar } from './SessionSidebar';
import { MessageThread } from './MessageThread';

interface ChatContainerProps {
  backendToken: string;
  sessionId: string | null;
}

export function ChatContainer({ backendToken, sessionId }: ChatContainerProps) {
  const refreshSessionsRef = useRef<(() => void) | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  );

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
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
      />
      {sessionId ? (
        <MessageThread
          key={sessionId}
          backendToken={backendToken}
          sessionId={sessionId}
          onMessageSent={handleMessageSent}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            サイドバーからチャットを選択するか、新規チャットを開始してください
          </p>
        </div>
      )}
    </>
  );
}
