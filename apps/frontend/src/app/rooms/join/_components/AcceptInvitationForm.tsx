'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  AcceptInvitationError,
  AcceptInvitationErrorCode,
  Room,
} from '../../../../types/room';
import { acceptRoomInvitation } from '../../../../lib/api/rooms';

interface AcceptInvitationFormProps {
  token: string;
  backendToken: string;
}

interface ErrorState {
  code: AcceptInvitationErrorCode;
  message: string;
}

export function AcceptInvitationForm({
  token,
  backendToken,
}: AcceptInvitationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<ErrorState | null>(null);
  const [joinedRoom, setJoinedRoom] = useState<Room | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAccept = () => {
    startTransition(async () => {
      setError(null);
      try {
        const room = await acceptRoomInvitation(token, backendToken);
        setJoinedRoom(room);
        router.push(`/rooms/${room.id}`);
      } catch (e) {
        if (e instanceof AcceptInvitationError) {
          setError({ code: e.code, message: e.message });
        } else {
          setError({
            code: 'unknown',
            message: e instanceof Error ? e.message : '招待リンクの受諾に失敗しました',
          });
        }
      }
    });
  };

  // 参加成功後に router.push が遷移するまでの間だけ表示される
  if (joinedRoom) {
    return (
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        ルーム「{joinedRoom.name}」に参加しました。画面を切り替えています…
      </p>
    );
  }

  if (error) {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm text-red-500">{error.message}</p>
        {error.code === 'already_member' ? (
          <Link
            href="/rooms"
            className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            ルーム一覧を開く
          </Link>
        ) : (
          <Link
            href="/rooms"
            className="inline-block text-sm text-zinc-700 underline dark:text-zinc-300"
          >
            ルーム一覧に戻る
          </Link>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAccept}
      disabled={isPending}
      className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {isPending ? '参加中…' : '参加する'}
    </button>
  );
}
