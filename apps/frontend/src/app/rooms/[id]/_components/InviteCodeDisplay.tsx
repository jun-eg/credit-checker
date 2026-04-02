'use client';

interface InviteCodeDisplayProps {
  inviteCode: string;
}

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteCode);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">{inviteCode}</span>
      <button
        onClick={handleCopy}
        className="rounded px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        コピー
      </button>
    </div>
  );
}
