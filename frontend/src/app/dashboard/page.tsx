import { auth, signOut } from '../../../auth';
import { redirect } from 'next/navigation';
import { ReceiptUploadCard } from './_components/ReceiptUploadCard';
import { ChatPanel } from './_components/ChatPanel';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Credit Checker
          </h1>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button
              type="submit"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <ReceiptUploadCard backendToken={session.backendToken} />
        <ChatPanel backendToken={session.backendToken} />
      </main>
    </div>
  );
}
