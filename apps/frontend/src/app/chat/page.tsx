import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { AppHeader } from '../../components/AppHeader';
import { ChatContainer } from './_components/ChatContainer';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const { session: sessionId } = await searchParams;

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/chat" />

      <main className="flex flex-1 overflow-hidden">
        <ChatContainer
          backendToken={session.backendToken}
          sessionId={sessionId ?? null}
        />
      </main>
    </div>
  );
}
