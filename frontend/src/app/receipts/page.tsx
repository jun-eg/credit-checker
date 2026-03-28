import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { AppHeader } from '../../components/AppHeader';
import { ReceiptUploadCard } from '../dashboard/_components/ReceiptUploadCard';
import { ReceiptList } from './_components/ReceiptList';
import { listReceipts } from '../../lib/api/receipts';
import { ListReceiptItem } from '../../types/receipt';

export default async function ReceiptsPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  let receipts: ListReceiptItem[] = [];
  try {
    const data = await listReceipts(session.backendToken);
    receipts = data.items;
  } catch {
    // 取得失敗時は空配列のまま
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/receipts" />

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <ReceiptUploadCard backendToken={session.backendToken} />

        <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-8 py-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              レシート一覧
            </h2>
          </div>
          <ReceiptList receipts={receipts} backendToken={session.backendToken} />
        </div>
      </main>
    </div>
  );
}
