'use client';

import { useRouter } from 'next/navigation';
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
      className="shrink-0 pt-0.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 sm:pt-0 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      退出
    </button>
  );
}
