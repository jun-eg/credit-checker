'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { leaveRoom, deleteRoom } from '../../../../lib/api/rooms';

interface RoomActionsProps {
  roomId: string;
  isOwner: boolean;
  backendToken: string;
}

export function RoomActions({ roomId, isOwner, backendToken }: RoomActionsProps) {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = async () => {
    if (!confirm('このルームから退出しますか？')) return;
    setIsLeaving(true);
    setError(null);
    try {
      await leaveRoom(roomId, backendToken);
      router.push('/rooms');
    } catch (e) {
      setError(e instanceof Error ? e.message : '退出に失敗しました');
      setIsLeaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('このルームを削除しますか？この操作は取り消せません。')) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteRoom(roomId, backendToken);
      router.push('/rooms');
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <div className="flex gap-2">
        {!isOwner && (
          <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            {isLeaving ? '退出中...' : 'ルームを退出'}
          </button>
        )}
        {isOwner && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/30"
          >
            {isDeleting ? '削除中...' : 'ルームを削除'}
          </button>
        )}
      </div>
    </div>
  );
}
