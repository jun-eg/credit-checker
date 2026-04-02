'use client';

import { useRouter } from 'next/navigation';
import { Room } from '../../../types/room';

interface ReceiptTabsProps {
  rooms: Room[];
  currentRoomId: string | null;
}

export function ReceiptTabs({ rooms, currentRoomId }: ReceiptTabsProps) {
  const router = useRouter();

  const tabs = [
    { label: '個人', roomId: null },
    ...rooms.map((room) => ({ label: room.name, roomId: room.id })),
  ];

  const handleTabClick = (roomId: string | null) => {
    if (roomId === null) {
      router.push('/receipts');
    } else {
      router.push(`/receipts?roomId=${roomId}`);
    }
  };

  return (
    <div className="flex gap-1 border-b border-zinc-100 px-4 sm:px-8 dark:border-zinc-800">
      {tabs.map((tab) => {
        const isActive = tab.roomId === currentRoomId;
        return (
          <button
            key={tab.roomId ?? '__personal__'}
            onClick={() => handleTabClick(tab.roomId)}
            className={`px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
