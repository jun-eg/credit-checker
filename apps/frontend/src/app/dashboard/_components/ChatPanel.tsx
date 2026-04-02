import Link from 'next/link';

export function ChatPanel() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">支出アシスタント</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        支出についての質問にAIがお答えします。過去のチャット履歴も確認できます。
      </p>
      <Link
        href="/chat"
        className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        チャットで質問する
      </Link>
    </div>
  );
}
