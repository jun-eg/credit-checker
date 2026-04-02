import Link from 'next/link';
import { Room } from '../../../types/room';

interface RoomCardProps {
  room: Room;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <li className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
      <Link
        href={`/rooms/${room.id}`}
        className="flex items-center px-4 py-4 transition-colors hover:bg-zinc-50 sm:px-8 dark:hover:bg-zinc-800/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {room.name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
            {room.memberCount}人のメンバー
          </p>
        </div>
        <svg
          className="ml-3 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  );
}
