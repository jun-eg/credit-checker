import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { AppHeader } from '../../components/AppHeader';
import { CategoryBarChart } from '../../components/CategoryBarChart';
import { MonthlyBarChart } from '../../components/MonthlyBarChart';
import { getMonthlySummary, getYearlySummary } from '../../lib/api/receipts';
import { listRoomReceipts } from '../../lib/api/rooms';
import { ReceiptUploadCard } from './_components/ReceiptUploadCard';

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseRoomFromCookie(cookieValue: string): { id: string; name: string } | null {
  if (!cookieValue.startsWith('room:')) return null;
  const [, id, encodedName] = cookieValue.split(':');
  if (!id || !encodedName) return null;
  return { id, name: decodeURIComponent(encodedName) };
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const cookieStore = await cookies();
  const modeCookieValue = cookieStore.get('app-mode')?.value ?? '';
  const currentRoom = parseRoomFromCookie(modeCookieValue);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (currentRoom) {
    // Roomモード: ルームのレシート一覧を表示
    const receipts = await listRoomReceipts(currentRoom.id, session.backendToken).catch(() => []);

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <AppHeader currentPath="/dashboard" />

        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {currentRoom.name} のレシート
              </h2>
              <Link
                href="/receipts"
                className="text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                一覧 →
              </Link>
            </div>

            {receipts.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-600">
                レシートがまだありません
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {receipts.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-900 dark:text-zinc-50">
                        {r.storeName ?? r.originalFileName}
                      </p>
                      {r.uploaderDisplayName && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-600">
                          {r.uploaderDisplayName}
                        </p>
                      )}
                    </div>
                    {r.total != null && r.currency && (
                      <span className="ml-4 shrink-0 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatAmount(r.total, r.currency)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ReceiptUploadCard backendToken={session.backendToken} currentRoom={currentRoom} />
        </main>
      </div>
    );
  }

  // 個人モード: サマリー表示
  const [monthlySummary, yearlySummary] = await Promise.allSettled([
    getMonthlySummary(session.backendToken, year, month),
    getYearlySummary(session.backendToken, year),
  ]);

  const monthly = monthlySummary.status === 'fulfilled' ? monthlySummary.value : null;
  const yearly = yearlySummary.status === 'fulfilled' ? yearlySummary.value : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/dashboard" />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">

        {/* 上段: 今月・今年 スマホ1列・PC2列 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

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

      </main>
    </div>
  );
}
