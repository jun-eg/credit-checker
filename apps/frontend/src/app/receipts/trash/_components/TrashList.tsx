'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ListReceiptItem } from '../../../../types/receipt';
import { restoreReceipt, permanentDeleteReceipt } from '../../../../lib/api/receipts';

interface TrashListProps {
  receipts: ListReceiptItem[];
  backendToken: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr));
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null || currency === null) return '—';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getRemainingDays(deletedAt: string | null | undefined): number | null {
  if (!deletedAt) return null;
  const deletedDate = new Date(deletedAt);
  const expiryDate = new Date(deletedDate);
  expiryDate.setDate(expiryDate.getDate() + 30);
  const now = new Date();
  const diff = expiryDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function TrashList({ receipts: initial, backendToken }: TrashListProps) {
  const router = useRouter();
  const [receipts, setReceipts] = useState(initial);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
    try {
      await restoreReceipt(id, backendToken);
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch {
      // 失敗時はそのまま
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await permanentDeleteReceipt(id, backendToken);
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmId(null);
      router.refresh();
    } catch {
      // 失敗時はそのまま
    }
  };

  if (receipts.length === 0) {
    return (
      <div className="px-8 py-12 text-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-600">ゴミ箱は空です</p>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-zinc-100 px-4 py-3 sm:px-6 dark:border-zinc-800">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          削除されたレシートは30日後に自動的に完全削除されます
        </p>
      </div>

      <ul>
        {receipts.map((receipt, idx) => {
          const remaining = getRemainingDays(receipt.deletedAt);
          return (
            <TrashRow
              key={receipt.id}
              receipt={receipt}
              remainingDays={remaining}
              isLast={idx === receipts.length - 1}
              onRestore={handleRestore}
              onPermanentDelete={(id) => setDeleteConfirmId(id)}
            />
          );
        })}
      </ul>

      {deleteConfirmId && (
        <DeleteConfirmDialog
          onConfirm={() => handlePermanentDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </>
  );
}

interface TrashRowProps {
  receipt: ListReceiptItem;
  remainingDays: number | null;
  isLast: boolean;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}

function TrashRow({ receipt, remainingDays, isLast, onRestore, onPermanentDelete }: TrashRowProps) {
  const [isRestoring, startRestoreTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  return (
    <li className={!isLast ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}>
      <div className="flex items-center gap-2 px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {receipt.storeName ?? receipt.originalFileName}
            </p>
            <span className="shrink-0 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
              {formatAmount(receipt.total, receipt.currency)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              削除日: {formatDate(receipt.deletedAt ?? null)}
            </p>
            {remainingDays !== null && (
              <span className={`shrink-0 text-xs ${remainingDays <= 7 ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                あと{remainingDays}日
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => startRestoreTransition(() => onRestore(receipt.id))}
            disabled={isRestoring}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950"
          >
            {isRestoring ? '復元中...' : '復元'}
          </button>
          <button
            onClick={() => startDeleteTransition(() => onPermanentDelete(receipt.id))}
            disabled={isDeleting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            完全削除
          </button>
        </div>
      </div>
    </li>
  );
}

interface DeleteConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const [isDeleting, startTransition] = useTransition();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          完全に削除しますか？
        </h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          このレシートは完全に削除され、復元できなくなります。
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            キャンセル
          </button>
          <button
            onClick={() => startTransition(() => onConfirm())}
            disabled={isDeleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? '削除中...' : '完全削除'}
          </button>
        </div>
      </div>
    </div>
  );
}
