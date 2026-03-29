import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { AppHeader } from '../../components/AppHeader';
import { ChatPanel } from './_components/ChatPanel';

export default async function ChatPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/chat" />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <ChatPanel backendToken={session.backendToken} />
      </main>
    </div>
  );
}
