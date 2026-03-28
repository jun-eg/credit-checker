import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '../../components/AppHeader';
import { CategoryBarChart } from '../../components/CategoryBarChart';
import { MonthlyBarChart } from '../../components/MonthlyBarChart';
import { ChatPanel } from './_components/ChatPanel';
import { getMonthlySummary, getYearlySummary } from '../../lib/api/receipts';

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

  const [monthlySummary, yearlySummary] = await Promise.allSettled([
    getMonthlySummary(session.backendToken, year, month),
    getYearlySummary(session.backendToken, year),
  ]);

  const monthly = monthlySummary.status === 'fulfilled' ? monthlySummary.value : null;
  const yearly = yearlySummary.status === 'fulfilled' ? yearlySummary.value : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/dashboard" />

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">

        {/* 上段: 今月・今年 横並び */}
        <div className="grid grid-cols-2 gap-6">

          {/* 今月の支出 */}
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {year}年{month}月の支出
              </h2>
              <Link
                href="/receipts"
                className="text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                一覧 →
              </Link>
            </div>

            {monthly ? (
              <>
                <p className="mb-6 text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatAmount(monthly.total, monthly.currency)}
                </p>
                {monthly.byCategory.length > 0 ? (
                  <CategoryBarChart data={monthly.byCategory} currency={monthly.currency} />
                ) : (
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">
                    今月の解析済みレシートがありません
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-600">データの取得に失敗しました</p>
            )}
          </div>

          {/* 今年の支出 */}
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {year}年の支出
              </h2>
              {yearly && (
                <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatAmount(yearly.total, yearly.currency)}
                </span>
              )}
            </div>

            {yearly ? (
              yearly.byCategory.length > 0 ? (
                <CategoryBarChart data={yearly.byCategory} currency={yearly.currency} />
              ) : (
                <p className="text-sm text-zinc-400 dark:text-zinc-600">
                  今年の解析済みレシートがありません
                </p>
              )
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-600">データの取得に失敗しました</p>
            )}
          </div>
        </div>

        {/* 下段: 月別支出 全幅 */}
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {year}年 月別支出
          </h2>

          {yearly ? (
            <MonthlyBarChart data={yearly.byMonthCategory} currency={yearly.currency} />
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-600">データの取得に失敗しました</p>
          )}
        </div>

        {/* チャット */}
        <ChatPanel backendToken={session.backendToken} />
      </main>
    </div>
  );
}
