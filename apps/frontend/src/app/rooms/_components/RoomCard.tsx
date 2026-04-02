import { Room } from '../../../types/room';

interface RoomCardProps {
  room: Room;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <li className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
      <div className="flex items-center px-4 py-4 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {room.name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
            {room.memberCount}人のメンバー
          </p>
        </div>
      </div>
    </li>
  );
}
