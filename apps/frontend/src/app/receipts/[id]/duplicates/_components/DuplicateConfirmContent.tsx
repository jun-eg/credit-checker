'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReceiptDetailContent } from '../../../../../components/ReceiptDetailContent';
import { deleteReceipt } from '../../../../../lib/api/receipts';
import { GetReceiptDetailResponse } from '../../../../../types/receipt';

interface DuplicateConfirmContentProps {
  receipt: GetReceiptDetailResponse;
  duplicate: GetReceiptDetailResponse;
  token: string;
  imageUrl?: string;
  duplicateImageUrl?: string;
  duplicateIndex: number;
  duplicateTotal: number;
}

export function DuplicateConfirmContent({
  receipt,
  duplicate,
  token,
  imageUrl,
  duplicateImageUrl,
  duplicateIndex,
  duplicateTotal,
}: DuplicateConfirmContentProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReject = () => {
    // 重複ではないと判断してレシート一覧に戻る
    router.push('/receipts');
  };

  const handleApprove = async () => {
    // 重複と確定し、新しいレシートを削除して一覧に戻る
    setIsDeleting(true);
    setError(null);
    try {
      await deleteReceipt(receipt.id, token);
      router.push('/receipts');
    } catch {
      setError('削除に失敗しました。もう一度お試しください。');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 新しいレシート（左） */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              新しいレシート
            </span>
          </div>
          <ReceiptDetailContent receipt={receipt} imageUrl={imageUrl} />
        </div>

        {/* 既存レシート（右） */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              重複の可能性があるレシート
            </span>
            {duplicateTotal > 1 && (
              <span className="text-xs text-zinc-400 dark:text-zinc-600">
                {duplicateIndex + 1} / {duplicateTotal} 件
              </span>
            )}
          </div>
          <ReceiptDetailContent receipt={duplicate} imageUrl={duplicateImageUrl} />
        </div>
      </div>

      {/* アクションエリア */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {error && (
          <p className="mb-4 text-center text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={handleReject}
            disabled={isDeleting}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-8 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:w-auto"
          >
            却下（重複ではない）
          </button>
          <button
            onClick={handleApprove}
            disabled={isDeleting}
            className="w-full rounded-xl bg-red-500 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700 sm:w-auto"
          >
            {isDeleting ? '削除中…' : '承認（重複として削除）'}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-600">
          「承認」すると新しいレシートが削除されます。この操作は取り消せません。
        </p>
      </div>
    </div>
  );
}
