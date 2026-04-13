'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeMember } from '../../../../lib/api/rooms';
import { RoomMember } from '../../../../types/room';

interface MemberListProps {
  members: RoomMember[];
  isOwner: boolean;
  roomId: string;
  backendToken: string;
}

export function MemberList({ members: initialMembers, isOwner, roomId, backendToken }: MemberListProps) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async (memberId: string) => {
    setIsRemoving(true);
    try {
      await removeMember(roomId, memberId, backendToken);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setConfirmTarget(null);
      router.refresh();
    } catch {
      // エラー時はダイアログを閉じて行をそのまま残す
      setConfirmTarget(null);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <ul className="space-y-2">
      {members.map((member) => (
        <li key={member.id} className="flex items-center gap-2">
          <span className="text-sm text-zinc-900 dark:text-zinc-50">
            {member.displayName ?? member.userId}
          </span>
          {member.role === 'owner' && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              オーナー
            </span>
          )}
          {isOwner && member.role !== 'owner' && (
            <>
              {confirmTarget === member.id ? (
                <span className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => setConfirmTarget(null)}
                    disabled={isRemoving}
                    className="rounded px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleRemove(member.id)}
                    disabled={isRemoving}
                    className="rounded px-2 py-0.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
                  >
                    {isRemoving ? '除外中...' : '除外する'}
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmTarget(member.id)}
                  className="ml-auto rounded px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
                >
                  退会させる
                </button>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
