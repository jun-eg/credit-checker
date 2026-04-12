'use client';

import { useCallback, useEffect, useState } from 'react';
import { regenerateInviteCode } from '../../../../lib/api/rooms';

interface InviteCodeDisplayProps {
  inviteCode: string;
  inviteCodeExpiresAt: string;
  roomId: string;
  backendToken: string;
}

function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '期��切れ';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `残り ${minutes}分${seconds.toString().padStart(2, '0')}秒`;
}

export function InviteCodeDisplay({
  inviteCode: initialInviteCode,
  inviteCodeExpiresAt: initialExpiresAt,
  roomId,
  backendToken,
}: InviteCodeDisplayProps) {
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [remainingMs, setRemainingMs] = useState(
    () => new Date(initialExpiresAt).getTime() - Date.now(),
  );
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const isExpired = remainingMs <= 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteCode);
  };

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      const result = await regenerateInviteCode(roomId, backendToken);
      setInviteCode(result.inviteCode);
      setExpiresAt(result.inviteCodeExpiresAt);
      setRemainingMs(new Date(result.inviteCodeExpiresAt).getTime() - Date.now());
    } catch {
      // エラーは握りつぶさず再スローしないが、UI上は再生成ボタンを有効に戻す
    } finally {
      setIsRegenerating(false);
    }
  }, [roomId, backendToken]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-sm ${isExpired ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-700 dark:text-zinc-300'}`}
        >
          {inviteCode}
        </span>
        {!isExpired && (
          <button
            onClick={handleCopy}
            className="rounded px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            コピー
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-xs ${isExpired ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}
        >
          {isExpired ? '期限切れ（再生成してください）' : formatRemainingTime(remainingMs)}
        </span>
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="rounded px-2 py-0.5 text-xs text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-zinc-800"
        >
          {isRegenerating ? '再生成中...' : '再生成'}
        </button>
      </div>
    </div>
  );
}
