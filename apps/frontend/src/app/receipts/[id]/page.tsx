import { auth } from '../../../../auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '../../../components/AppHeader';
import { ReceiptDetailContent } from '../../../components/ReceiptDetailContent';
import { getReceiptDetail, getReceiptImagePresignedUrl } from '../../../lib/api/receipts';

interface ReceiptDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const { id } = await params;
  const [receipt, imageUrl] = await Promise.all([
    getReceiptDetail(id, session.backendToken).catch(() => notFound()),
    getReceiptImagePresignedUrl(id, session.backendToken).catch(() => null),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/receipts" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/receipts"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← レシート一覧
        </Link>

        <ReceiptDetailContent receipt={receipt} imageUrl={imageUrl ?? undefined} />
      </main>
    </div>
  );
}
