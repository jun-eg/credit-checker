import { auth } from '../../../../auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '../../../components/AppHeader';
import { getReceiptDetail } from '../../../lib/api/receipts';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
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

interface ReceiptDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const { id } = await params;

  const receipt = await getReceiptDetail(id, session.backendToken).catch(() => notFound());

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/receipts" />

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        {/* ナビゲーション */}
        <Link
          href="/receipts"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← レシート一覧
        </Link>

        {/* レシート基本情報 */}
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {receipt.storeName ?? receipt.originalFileName}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {formatDate(receipt.purchasedAt)}
            </p>
          </div>

          <div className="flex items-end justify-between border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">合計</span>
            <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatAmount(receipt.total, receipt.currency)}
            </span>
          </div>
        </div>

        {/* 商品明細 */}
        {receipt.items.length > 0 && (
          <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-8 py-5 dark:border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                商品明細
              </h3>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-8 py-3 text-left text-xs font-medium text-zinc-400 dark:text-zinc-600">
                    商品名
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">
                    カテゴリ
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">
                    数量
                  </th>
                  <th className="px-8 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">
                    金額
                  </th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={idx < receipt.items.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}
                  >
                    <td className="px-8 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                      {item.name}
                    </td>
                    <td className="px-4 py-4 text-right text-xs text-zinc-400 dark:text-zinc-600">
                      {item.category ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                      {item.quantity}
                    </td>
                    <td className="px-8 py-4 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatAmount(item.totalPrice, receipt.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 解析中・未解析の場合 */}
        {receipt.status !== 'completed' && (
          <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
            <p className="text-center text-sm text-zinc-400 dark:text-zinc-600">
              {receipt.status === 'failed'
                ? 'レシートの解析に失敗しました'
                : '解析中です。しばらくお待ちください…'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
