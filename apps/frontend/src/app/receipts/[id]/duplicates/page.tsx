import { auth } from '../../../../../auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '../../../../components/AppHeader';
import { getReceiptDetail, getReceiptImagePresignedUrl } from '../../../../lib/api/receipts';
import { DuplicateConfirmContent } from './_components/DuplicateConfirmContent';

interface DuplicateCheckPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ index?: string }>;
}

export default async function DuplicateCheckPage({
  params,
  searchParams,
}: DuplicateCheckPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const { id } = await params;
  const { index } = await searchParams;
  const receipt = await getReceiptDetail(id, session.backendToken).catch(() => notFound());

  if (!receipt.possibleDuplicateIds || receipt.possibleDuplicateIds.length === 0) {
    redirect(`/receipts/${id}`);
  }

  const duplicateIndex = Math.min(
    Math.max(0, Number(index ?? 0)),
    receipt.possibleDuplicateIds.length - 1,
  );
  const duplicateId = receipt.possibleDuplicateIds[duplicateIndex];
  const [duplicate, imageUrl, duplicateImageUrl] = await Promise.all([
    getReceiptDetail(duplicateId, session.backendToken).catch(() => notFound()),
    getReceiptImagePresignedUrl(id, session.backendToken).catch(() => null),
    getReceiptImagePresignedUrl(duplicateId, session.backendToken).catch(() => null),
  ]);

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/receipts" />

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        {/* ナビゲーション */}
        <Link
          href={`/receipts/${id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← レシート詳細に戻る
        </Link>

        {/* ページタイトル */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">重複確認</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            同日・同額の既存レシートが見つかりました。内容を確認して操作を選択してください。
          </p>
        </div>

        {/* 複数件ある場合のページネーション */}
        {receipt.possibleDuplicateIds.length > 1 && (
          <div className="flex items-center gap-2">
            {receipt.possibleDuplicateIds.map((_, i) => (
              <Link
                key={i}
                href={`/receipts/${id}/duplicates?index=${i}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  i === duplicateIndex
                    ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {i + 1}
              </Link>
            ))}
          </div>
        )}

        <DuplicateConfirmContent
          receipt={receipt}
          duplicate={duplicate}
          token={session.backendToken}
          imageUrl={imageUrl ?? undefined}
          duplicateImageUrl={duplicateImageUrl ?? undefined}
          duplicateIndex={duplicateIndex}
          duplicateTotal={receipt.possibleDuplicateIds.length}
        />
      </main>
    </div>
  );
}
