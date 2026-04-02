import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { getRooms } from '../../lib/api/rooms';
import { SelectView } from './_components/SelectView';

export default async function SelectPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const rooms = await getRooms(session.backendToken).catch(() => []);

  return <SelectView rooms={rooms} backendToken={session.backendToken} />;
}
