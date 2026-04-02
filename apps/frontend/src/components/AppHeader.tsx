import Link from 'next/link';
import { signOut } from '../../auth';

interface AppHeaderProps {
  currentPath?: string;
}

export function AppHeader({ currentPath }: AppHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* スマホ: ロゴとログアウトを上段、ナビを下段。PC: 全て横並び */}
        <div className="flex items-start justify-between py-3 sm:items-center sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href="/dashboard"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Credit Checker
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className={`text-sm transition-colors ${
                  currentPath === '/dashboard'
                    ? 'text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                }`}
              >
                ダッシュボード
              </Link>
              <Link
                href="/receipts"
                className={`text-sm transition-colors ${
                  currentPath === '/receipts'
                    ? 'text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                }`}
              >
                レシート
              </Link>
              <Link
                href="/chat"
                className={`text-sm transition-colors ${
                  currentPath === '/chat'
                    ? 'text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                }`}
              >
                チャット
              </Link>
              <Link
                href="/rooms"
                className={`text-sm transition-colors ${
                  currentPath === '/rooms'
                    ? 'text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                }`}
              >
                ルーム
              </Link>
            </nav>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button
              type="submit"
              className="shrink-0 pt-0.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 sm:pt-0 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
