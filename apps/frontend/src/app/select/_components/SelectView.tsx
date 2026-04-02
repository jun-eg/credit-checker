'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Room } from '../../../types/room';
import { useMode } from '../../../contexts/ModeContext';
import { RoomCreateModal } from '../../rooms/_components/RoomCreateModal';
import { RoomJoinModal } from '../../rooms/_components/RoomJoinModal';

interface SelectViewProps {
  rooms: Room[];
  backendToken: string;
}

type ModalState = 'none' | 'create' | 'join';

export function SelectView({ rooms: initialRooms, backendToken }: SelectViewProps) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [modalState, setModalState] = useState<ModalState>('none');
  const { setMode } = useMode();
  const router = useRouter();

  const enterPersonal = () => {
    setMode({ type: 'personal' });
    router.push('/dashboard');
  };

  const enterRoom = (room: Room) => {
    setMode({ type: 'room', room: { id: room.id, name: room.name } });
    router.push('/dashboard');
  };

  const handleRoomCreated = (room: Room) => {
    setModalState('none');
    enterRoom(room);
  };

  const handleRoomJoined = (room: Room) => {
    setModalState('none');
    // 参加したRoomが一覧になければ追加
    setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [...prev, room]));
    enterRoom(room);
  };

  return (
    <>
      <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              どのモードで使いますか？
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              あとからヘッダーの退出ボタンで切り替えられます
            </p>
          </div>

          {/* 個人 */}
          <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
            <div className="px-6 py-5">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">個人</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                自分だけのレシート管理
              </p>
              <button
                onClick={enterPersonal}
                className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                個人で使う
              </button>
            </div>
          </div>

          {/* Room */}
          <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
            <div className="px-6 py-5">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Room</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                家族や友人とレシートを共有
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setModalState('create')}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Roomを作成
                </button>
                <button
                  onClick={() => setModalState('join')}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Roomに参加
                </button>
              </div>
            </div>

            {rooms.length > 0 && (
              <div className="border-t border-zinc-100 dark:border-zinc-800">
                <p className="px-6 pb-2 pt-4 text-xs font-medium text-zinc-400 dark:text-zinc-600">
                  参加中のRoom
                </p>
                <ul>
                  {rooms.map((room) => (
                    <li
                      key={room.id}
                      className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                    >
                      <button
                        onClick={() => enterRoom(room)}
                        className="flex w-full items-center px-6 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
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
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalState === 'create' && (
        <RoomCreateModal
          backendToken={backendToken}
          onCreated={handleRoomCreated}
          onClose={() => setModalState('none')}
        />
      )}

      {modalState === 'join' && (
        <RoomJoinModal
          backendToken={backendToken}
          onJoined={handleRoomJoined}
          onClose={() => setModalState('none')}
        />
      )}
    </>
  );
}
