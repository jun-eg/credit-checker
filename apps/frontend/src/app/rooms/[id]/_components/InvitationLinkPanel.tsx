'use client';

import { useEffect, useState, useTransition } from 'react';
import { RoomInvitation } from '../../../../types/room';
import { issueRoomInvitation } from '../../../../lib/api/rooms';

interface InvitationLinkPanelProps {
  roomId: string;
  backendToken: string;
}

interface CountdownState {
  label: string;
  expired: boolean;
}

function formatCountdown(expiresAt: string): CountdownState {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return { label: '失効済み', expired: true };
  }
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    label: `残り ${minutes}:${seconds.toString().padStart(2, '0')}`,
    expired: false,
  };
}

export function InvitationLinkPanel({ roomId, backendToken }: InvitationLinkPanelProps) {
  const [invitation, setInvitation] = useState<RoomInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<CountdownState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!invitation) {
      setCountdown(null);
      return;
    }
    // 1秒ごとに残り時間を再計算する（失効後も1度更新するため即時更新→interval）
    const update = () => setCountdown(formatCountdown(invitation.expiresAt));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [invitation]);

  const handleIssue = () => {
    startTransition(async () => {
      setError(null);
      setCopied(false);
      try {
        const result = await issueRoomInvitation(roomId, backendToken);
        setInvitation(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : '招待リンクの発行に失敗しました');
      }
    });
  };

  const handleCopy = async () => {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleIssue}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending
            ? '発行中…'
            : invitation
              ? '新しい招待リンクを発行'
              : '招待リンクを発行'}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          有効期限 30分 / 1人のみ参加可能
        </span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {invitation && (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={invitation.url}
              className="w-full min-w-0 flex-1 rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              disabled={countdown?.expired}
              className="shrink-0 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              {copied ? 'コピーしました' : 'コピー'}
            </button>
          </div>
          <p
            className={`text-xs ${countdown?.expired ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}
          >
            {countdown?.label ?? ''}
          </p>
        </div>
      )}
    </div>
  );
}
