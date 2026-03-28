import { auth } from '../../auth';
import { signIn } from '../../auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex flex-col items-center gap-8 rounded-2xl bg-white p-12 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Credit Checker
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          レシートを管理して支出を把握しよう
        </p>
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/dashboard' });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Google でログイン
          </button>
        </form>
      </div>
    </div>
  );
}
