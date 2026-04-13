'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createChatSession,
  getChatSessions,
  updateChatSession,
  deleteChatSession,
} from '../../../lib/api/chat';
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

  // アクションメニュー展開中のセッションID
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // インライン編集中のセッションID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  // 削除確認ダイアログのセッションID
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

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

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpenId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

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
    if (editingId || deleteConfirmId) return;
    router.push(`/chat?session=${sessionId}`);
  };

  const handleMenuToggle = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setMenuOpenId((prev) => (prev === sessionId ? null : sessionId));
  };

  const handleStartEdit = (session: ChatSession) => {
    setMenuOpenId(null);
    setEditingId(session.id);
    setEditTitle(session.title ?? '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleSaveEdit = async (sessionId: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    try {
      await updateChatSession(sessionId, trimmed, backendToken);
      setEditingId(null);
      setEditTitle('');
      await loadSessions();
    } catch {
      // 失敗時はそのまま
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(sessionId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleStartDelete = (sessionId: string) => {
    setMenuOpenId(null);
    setDeleteConfirmId(sessionId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await deleteChatSession(deleteConfirmId, backendToken);
      if (deleteConfirmId === currentSessionId) {
        router.push('/chat');
      }
      setDeleteConfirmId(null);
      await loadSessions();
    } catch {
      // 失敗時はそのまま
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  return (
    <div className="relative flex shrink-0">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-in-out sm:static sm:z-auto dark:border-zinc-800 dark:bg-zinc-900 ${
          isOpen ? 'w-full sm:w-64' : 'w-0'
        } overflow-hidden`}
      >
        <div className="flex min-w-[100vw] items-center justify-between border-b border-zinc-200 px-4 py-4 sm:min-w-64 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 sm:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="サイドバーを閉じる"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">チャット履歴</span>
          </div>
          <button
            onClick={handleNewChat}
            disabled={creating}
            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {creating ? '作成中...' : '+ 新規'}
          </button>
        </div>

        <div className="min-w-[100vw] flex-1 overflow-y-auto py-2 sm:min-w-64">
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
              const isEditing = editingId === session.id;
              const isMenuOpen = menuOpenId === session.id;

              return (
                <div
                  key={session.id}
                  className={`group relative flex items-center transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    isActive ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                  }`}
                >
                  <button
                    onClick={() => handleSelectSession(session.id)}
                    className="min-w-0 flex-1 px-4 py-3 text-left"
                    disabled={isEditing}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                        onBlur={() => handleSaveEdit(session.id)}
                        autoFocus
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-400"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {session.title ?? '無題のチャット'}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                          {new Date(session.createdAt).toLocaleDateString('ja-JP')}
                        </p>
                      </>
                    )}
                  </button>

                  {/* 縦三点ドットアイコン */}
                  {!isEditing && (
                    <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
                      <button
                        onClick={(e) => handleMenuToggle(e, session.id)}
                        className={`mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 ${
                          isMenuOpen ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        aria-label="メニュー"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>

                      {/* アクションメニュー */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-8 z-10 w-28 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                          <button
                            onClick={() => handleStartEdit(session)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            編集
                          </button>
                          <button
                            onClick={() => handleStartDelete(session.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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

      {/* 削除確認ダイアログ */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              チャットを削除しますか？
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              このチャットセッションと全てのメッセージが削除されます。この操作は取り消せません。
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={deleting}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
