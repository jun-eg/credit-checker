'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createChatSession, getChatSessions } from '../../../lib/api/chat';
import { ChatSession } from '../../../types/chat';

type SidebarState =
  | { status: 'loading' }
  | { status: 'ready'; sessions: ChatSession[] }
  | { status: 'error' };

interface SessionSidebarProps {
  backendToken: string;
  currentSessionId: string | null;
  onSessionsRefresh?: (refresh: () => void) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function SessionSidebar({
  backendToken,
  currentSessionId,
  onSessionsRefresh,
  isOpen,
  onToggle,
}: SessionSidebarProps) {
  const router = useRouter();
  const [sidebarState, setSidebarState] = useState<SidebarState>({ status: 'loading' });
  const [creating, setCreating] = useState(false);

  const loadSessions = useCallback(async () => {
    setSidebarState({ status: 'loading' });
    try {
      const sessions = await getChatSessions(backendToken);
      setSidebarState({ status: 'ready', sessions });
    } catch {
      setSidebarState({ status: 'error' });
    }
  }, [backendToken]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    onSessionsRefresh?.(loadSessions);
  }, [onSessionsRefresh, loadSessions]);

  const handleNewChat = async () => {
    setCreating(true);
    try {
      const session = await createChatSession(backendToken);
      await loadSessions();
      router.push(`/chat?session=${session.id}`);
    } catch {
      // 失敗時はそのまま
    } finally {
      setCreating(false);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    router.push(`/chat?session=${sessionId}`);
  };

  return (
    <div className="relative flex shrink-0">
      <aside
        className={`flex flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-900 ${
          isOpen ? 'w-64' : 'w-0'
        } overflow-hidden`}
      >
        <div className="flex w-64 items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">チャット履歴</span>
          <button
            onClick={handleNewChat}
            disabled={creating}
            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {creating ? '作成中...' : '+ 新規'}
          </button>
        </div>

        <div className="w-64 flex-1 overflow-y-auto py-2">
          {sidebarState.status === 'loading' && (
            <p className="px-4 py-4 text-xs text-zinc-400 dark:text-zinc-500">読み込み中...</p>
          )}
          {sidebarState.status === 'error' && (
            <div className="px-4 py-4">
              <p className="text-xs text-red-500">取得に失敗しました</p>
              <button
                onClick={loadSessions}
                className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                再試行
              </button>
            </div>
          )}
          {sidebarState.status === 'ready' && sidebarState.sessions.length === 0 && (
            <p className="px-4 py-4 text-xs text-zinc-400 dark:text-zinc-500">
              チャット履歴がありません
            </p>
          )}
          {sidebarState.status === 'ready' &&
            sidebarState.sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              return (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                  }`}
                >
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {session.title ?? '無題のチャット'}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(session.createdAt).toLocaleDateString('ja-JP')}
                  </p>
                </button>
              );
            })}
        </div>
      </aside>

      {/* トグルボタン: サイドバーの右端に配置 */}
      <button
        onClick={onToggle}
        className="flex h-8 w-8 items-center justify-center self-start mt-3 -ml-1 rounded-r-md border border-l-0 border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        aria-label={isOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isOpen ? '' : 'rotate-180'}`}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  );
}
