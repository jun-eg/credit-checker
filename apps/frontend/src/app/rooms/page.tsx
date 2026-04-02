import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { AppHeader } from '../../components/AppHeader';
import { getRooms } from '../../lib/api/rooms';
import { Room } from '../../types/room';
import { RoomList } from './_components/RoomList';

export default async function RoomsPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  let rooms: Room[] = [];
  try {
    rooms = await getRooms(session.backendToken);
  } catch {
    // 取得失敗時は空配列のまま
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/rooms" />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <RoomList rooms={rooms} backendToken={session.backendToken} />
      </main>
    </div>
  );
}
