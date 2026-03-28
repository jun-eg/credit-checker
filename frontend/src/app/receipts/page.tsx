import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '../../components/AppHeader';
import { ReceiptUploadCard } from '../dashboard/_components/ReceiptUploadCard';
import { listReceipts } from '../../lib/api/receipts';
import { ListReceiptItem } from '../../types/receipt';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr));
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null || currency === null) return '—';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_LABELS: Record<ListReceiptItem['status'], string> = {
  pending: '待機中',
  processing: '解析中',
  completed: '完了',
  failed: '失敗',
};

const STATUS_STYLES: Record<ListReceiptItem['status'], string> = {
  pending: 'text-zinc-400',
  processing: 'text-amber-500',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
};

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
        {/* アップロードカード */}
        <ReceiptUploadCard backendToken={session.backendToken} />

        {/* レシート一覧 */}
        <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-8 py-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              レシート一覧
            </h2>
          </div>

          {receipts.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-600">
                レシートがありません
              </p>
            </div>
          ) : (
            <ul>
              {receipts.map((receipt, idx) => (
                <li
                  key={receipt.id}
                  className={idx < receipts.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}
                >
                  <Link
                    href={`/receipts/${receipt.id}`}
                    className="flex items-center justify-between px-8 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {receipt.storeName ?? receipt.originalFileName}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                        {formatDate(receipt.purchasedAt ?? receipt.createdAt)}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-4">
                      <span className={`text-xs ${STATUS_STYLES[receipt.status]}`}>
                        {STATUS_LABELS[receipt.status]}
                      </span>
                      <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatAmount(receipt.total, receipt.currency)}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-600">›</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
