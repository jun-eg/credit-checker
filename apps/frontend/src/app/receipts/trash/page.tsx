import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '../../../components/AppHeader';
import { TrashList } from './_components/TrashList';
import { getTrashReceipts } from '../../../lib/api/receipts';

export default async function TrashPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const trashData = await getTrashReceipts(session.backendToken).catch(() => ({ items: [] }));

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/receipts" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-center gap-3">
          <Link
            href="/receipts"
            className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            レシート一覧
          </Link>
        </div>

        <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-4 sm:px-8 sm:py-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              ゴミ箱
            </h2>
          </div>
          <TrashList
            receipts={trashData.items}
            backendToken={session.backendToken}
          />
        </div>
      </main>
    </div>
  );
}
