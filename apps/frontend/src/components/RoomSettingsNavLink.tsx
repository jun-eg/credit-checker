'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cog } from 'lucide-react';
import { useMode } from '../contexts/ModeContext';

export function RoomSettingsNavLink() {
  const { mode } = useMode();
  const pathname = usePathname();

  if (mode?.type !== 'room') return null;

  const href = `/rooms/${mode.room.id}`;
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`text-sm transition-colors ${
        isActive
          ? 'text-zinc-900 dark:text-zinc-50'
          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
      }`}
    >
      <Cog size={18} className="sm:hidden" />
      <span className="hidden sm:inline">ルーム設定</span>
    </Link>
  );
}
