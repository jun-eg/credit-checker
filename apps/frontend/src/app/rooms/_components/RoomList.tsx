'use client';

import { useState } from 'react';
import { Room } from '../../../types/room';
import { RoomCard } from './RoomCard';
import { RoomCreateModal } from './RoomCreateModal';
import { RoomJoinModal } from './RoomJoinModal';

interface RoomListProps {
  rooms: Room[];
  backendToken: string;
}

type ModalState = 'none' | 'create' | 'join';

export function RoomList({ rooms: initial, backendToken }: RoomListProps) {
  const [rooms, setRooms] = useState(initial);
  const [modalState, setModalState] = useState<ModalState>('none');

  const handleCreated = (room: Room) => {
    setRooms((prev) => [room, ...prev]);
    setModalState('none');
  };

  const handleJoined = (room: Room) => {
    // 既に参加済みのルームが返ってくる場合を考慮して重複排除
    setRooms((prev) =>
      prev.some((r) => r.id === room.id) ? prev : [room, ...prev],
    );
    setModalState('none');
  };

  return (
    <>
      <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 sm:px-8 sm:py-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            ルーム一覧
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalState('join')}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              ルームに参加
            </button>
            <button
              onClick={() => setModalState('create')}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              ルームを作成
            </button>
          </div>
        </div>

        {rooms.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-600">
              ルームがありません
            </p>
          </div>
        ) : (
          <ul>
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </ul>
        )}
      </div>

      {modalState === 'create' && (
        <RoomCreateModal
          backendToken={backendToken}
          onCreated={handleCreated}
          onClose={() => setModalState('none')}
        />
      )}

      {modalState === 'join' && (
        <RoomJoinModal
          backendToken={backendToken}
          onJoined={handleJoined}
          onClose={() => setModalState('none')}
        />
      )}
    </>
  );
}
