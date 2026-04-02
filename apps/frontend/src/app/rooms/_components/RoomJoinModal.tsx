'use client';

import { useState, useTransition, FormEvent } from 'react';
import { Room } from '../../../types/room';
import { joinRoom } from '../../../lib/api/rooms';

interface RoomJoinModalProps {
  backendToken: string;
  onJoined: (room: Room) => void;
  onClose: () => void;
}

export function RoomJoinModal({ backendToken, onJoined, onClose }: RoomJoinModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    startTransition(async () => {
      setError('');
      try {
        const room = await joinRoom(inviteCode.trim(), backendToken);
        onJoined(room);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ルームへの参加に失敗しました');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">ルームに参加</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="閉じる"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="invite-code"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                招待コード
              </label>
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="招待コードを入力"
                disabled={isPending}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600 dark:focus:border-zinc-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isPending || !inviteCode.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isPending ? '参加中…' : '参加'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.782 4.032a.575.575 0 1 0-.813-.814L7.5 6.687 4.032 3.218a.575.575 0 0 0-.814.814L6.687 7.5l-3.469 3.468a.575.575 0 0 0 .814.814L7.5 8.313l3.469 3.469a.575.575 0 0 0 .813-.814L8.313 7.5l3.469-3.468Z"
        fill="currentColor"
      />
    </svg>
  );
}
