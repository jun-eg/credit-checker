import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '../../components/AppHeader';
import { CategoryBarChart } from '../../components/CategoryBarChart';
import { ChatPanel } from './_components/ChatPanel';
import { getMonthlySummary } from '../../lib/api/receipts';

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let summary = null;
  try {
    summary = await getMonthlySummary(session.backendToken, year, month);
  } catch {
    // サマリー取得失敗時はnullのまま表示
  }

  const monthLabel = `${year}年${month}月`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/dashboard" />

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        {/* 当月サマリー */}
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {monthLabel}の支出
            </h2>
            <Link
              href="/receipts"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              レシート一覧 →
            </Link>
          </div>

          {summary ? (
            <>
              <p className="mb-8 text-4xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatAmount(summary.total, summary.currency)}
              </p>

              {summary.byCategory.length > 0 && (
                <div>
                  <h3 className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    カテゴリ別内訳
                  </h3>
                  <CategoryBarChart
                    data={summary.byCategory}
                    currency={summary.currency}
                  />
                </div>
              )}

              {summary.byCategory.length === 0 && summary.total === 0 && (
                <p className="text-sm text-zinc-400 dark:text-zinc-600">
                  今月の解析済みレシートがありません
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-600">
              データの取得に失敗しました
            </p>
          )}
        </div>

        {/* チャット */}
        <ChatPanel backendToken={session.backendToken} />
      </main>
    </div>
  );
}
