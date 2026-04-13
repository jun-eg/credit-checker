'use client';

import { useRouter } from 'next/navigation';
import { Signpost } from 'lucide-react';
import { useMode } from '../contexts/ModeContext';

export function ExitButton() {
  const { clearMode } = useMode();
  const router = useRouter();

  const handleExit = () => {
    clearMode();
    router.push('/select');
  };

  return (
    <button
      onClick={handleExit}
      className="shrink-0 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      <Signpost size={18} className="sm:hidden" />
      <span className="hidden sm:inline">退出</span>
    </button>
  );
}
