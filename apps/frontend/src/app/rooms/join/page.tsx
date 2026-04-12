import Link from 'next/link';
import { auth, signIn } from '../../../../auth';
import { AppHeader } from '../../../components/AppHeader';
import { AcceptInvitationForm } from './_components/AcceptInvitationForm';

interface JoinRoomPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function JoinRoomPage({ searchParams }: JoinRoomPageProps) {
  const { token } = await searchParams;
  const session = await auth();

  // トークンが欠けているケース
  if (!token) {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-black">
        <AppHeader currentPath="/rooms/join" />
        <main className="mx-auto max-w-md space-y-4 px-4 py-10">
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              招待リンクが無効です
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              トークンが含まれていません。招待リンクを発行したオーナーに確認してください。
            </p>
            <Link
              href="/rooms"
              className="mt-4 inline-block text-sm text-zinc-700 underline dark:text-zinc-300"
            >
              ルーム一覧に戻る
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // 未ログイン時はログイン後に同じ招待URLへ戻す
  if (!session) {
    const callbackUrl = `/rooms/join?token=${encodeURIComponent(token)}`;
    const handleSignIn = async () => {
      'use server';
      await signIn('google', { redirectTo: callbackUrl });
    };

    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-black">
        <AppHeader currentPath="/rooms/join" />
        <main className="mx-auto max-w-md space-y-4 px-4 py-10">
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              ルームに招待されています
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              参加するにはログインしてください。
            </p>
            <form action={handleSignIn} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Google でログインして参加
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/rooms/join" />
      <main className="mx-auto max-w-md space-y-4 px-4 py-10">
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            ルームに参加
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            招待リンクからルームに参加します。下のボタンを押して参加してください。
          </p>
          <AcceptInvitationForm token={token} backendToken={session.backendToken} />
        </div>
      </main>
    </div>
  );
}
