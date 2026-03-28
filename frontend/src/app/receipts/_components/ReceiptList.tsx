'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListReceiptItem } from '../../../types/receipt';
import { updateReceipt, deleteReceipt } from '../../../lib/api/receipts';

interface ReceiptListProps {
  receipts: ListReceiptItem[];
  backendToken: string;
}

const STATUS_LABELS: Record<ListReceiptItem['status'], string> = {
  pending: '待機中',
  processing: '解析中',
  completed: '完了',
  failed: '失敗',
};

const STATUS_STYLES: Record<ListReceiptItem['status'], string> = {
  pending: 'text-zinc-400',
  processing: 'text-amber-500',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
};

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

// 日付を <input type="date"> の値形式に変換
function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().slice(0, 10);
}

// ---- 編集モーダル ----

interface EditModalProps {
  receipt: ListReceiptItem;
  backendToken: string;
  onClose: () => void;
  onSaved: (updated: ListReceiptItem) => void;
}

function EditModal({ receipt, backendToken, onClose, onSaved }: EditModalProps) {
  const [storeName, setStoreName] = useState(receipt.storeName ?? '');
  const [purchasedAt, setPurchasedAt] = useState(toDateInputValue(receipt.purchasedAt));
  const [total, setTotal] = useState(receipt.total !== null ? String(receipt.total) : '');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      setError('');
      try {
        await updateReceipt(receipt.id, backendToken, {
          storeName: storeName || null,
          purchasedAt: purchasedAt || null,
          total: total !== '' ? Number(total) : null,
          currency: receipt.currency ?? 'JPY',
        });
        onSaved({
          ...receipt,
          storeName: storeName || null,
          purchasedAt: purchasedAt ? new Date(purchasedAt).toISOString() : null,
          total: total !== '' ? Number(total) : null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : '更新に失敗しました');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h3 className="mb-5 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          レシートを編集
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              店舗名
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="店舗名"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              購入日
            </label>
            <input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              合計金額
            </label>
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-500"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- レシート行 ----

interface ReceiptRowProps {
  receipt: ListReceiptItem;
  isLast: boolean;
  backendToken: string;
  onEdit: (receipt: ListReceiptItem) => void;
  onDelete: (id: string) => void;
}

function ReceiptRow({ receipt, isLast, backendToken: _token, onEdit, onDelete }: ReceiptRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      onDelete(receipt.id);
    });
  };

  return (
    <li className={!isLast ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}>
      <div className="flex items-center gap-2 px-6 py-4">
        {/* クリックで詳細へ */}
        <Link
          href={`/receipts/${receipt.id}`}
          className="flex min-w-0 flex-1 items-center gap-4 transition-colors hover:opacity-80"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {receipt.storeName ?? receipt.originalFileName}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
              {formatDate(receipt.purchasedAt ?? receipt.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className={`text-xs ${STATUS_STYLES[receipt.status]}`}>
              {STATUS_LABELS[receipt.status]}
            </span>
            <span className="w-24 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
              {formatAmount(receipt.total, receipt.currency)}
            </span>
            <span className="text-zinc-300 dark:text-zinc-600">›</span>
          </div>
        </Link>

        {/* 編集・削除ボタン */}
        <div className="ml-2 flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(receipt)}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="編集"
          >
            <PencilIcon />
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="rounded-lg px-2 py-1 text-xs text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
              >
                {isDeleting ? '削除中…' : '削除'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
              aria-label="削除"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ---- メインコンポーネント ----

export function ReceiptList({ receipts: initial, backendToken }: ReceiptListProps) {
  const router = useRouter();
  const [receipts, setReceipts] = useState(initial);
  const [editTarget, setEditTarget] = useState<ListReceiptItem | null>(null);

  const handleSaved = (updated: ListReceiptItem) => {
    setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditTarget(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReceipt(id, backendToken);
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch {
      // 削除失敗時は何もしない（行はそのまま残る）
    }
  };

  if (receipts.length === 0) {
    return (
      <div className="px-8 py-12 text-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-600">レシートがありません</p>
      </div>
    );
  }

  return (
    <>
      <ul>
        {receipts.map((receipt, idx) => (
          <ReceiptRow
            key={receipt.id}
            receipt={receipt}
            isLast={idx === receipts.length - 1}
            backendToken={backendToken}
            onEdit={setEditTarget}
            onDelete={handleDelete}
          />
        ))}
      </ul>

      {editTarget && (
        <EditModal
          receipt={editTarget}
          backendToken={backendToken}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

// ---- アイコン ----

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.854.146a.5.5 0 0 0-.707 0l-1.5 1.5a.5.5 0 0 0 0 .707l3 3a.5.5 0 0 0 .707 0l1.5-1.5a.5.5 0 0 0 0-.707l-3-3ZM1.5 10.5 9.793 2.207l3 3L4.5 13.5H1.5v-3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.5 1a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4ZM2 4.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H12v7.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5H2.5a.5.5 0 0 1-.5-.5ZM4 5v7.5h7V5H4Z"
        fill="currentColor"
      />
    </svg>
  );
}
