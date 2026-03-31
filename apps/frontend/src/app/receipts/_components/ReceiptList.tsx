'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type UpdateReceiptItemRequest, ListReceiptItem, GetReceiptDetailResponse } from '../../../types/receipt';
import { getReceiptDetail, updateReceipt, deleteReceipt } from '../../../lib/api/receipts';
import { ReceiptDetailContent } from '../../../components/ReceiptDetailContent';

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

// ---- 編集モーダル ----

interface EditModalProps {
  receiptId: string;
  backendToken: string;
  onClose: () => void;
  onSaved: (updated: ListReceiptItem) => void;
}

function EditModal({ receiptId, backendToken, onClose, onSaved }: EditModalProps) {
  const [detail, setDetail] = useState<GetReceiptDetailResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, startSaveTransition] = useTransition();

  useEffect(() => {
    getReceiptDetail(receiptId, backendToken)
      .then(setDetail)
      .catch(() => setLoadError('レシートの取得に失敗しました'));
  }, [receiptId, backendToken]);

  const handleSave = (data: { storeName: string | null; purchasedAt: string | null; total: number | null; items: UpdateReceiptItemRequest[] }) => {
    startSaveTransition(async () => {
      setSaveError('');
      try {
        await updateReceipt(receiptId, backendToken, {
          storeName: data.storeName,
          purchasedAt: data.purchasedAt,
          total: data.total,
          currency: detail?.currency ?? 'JPY',
          items: data.items,
        });
        onSaved({
          id: receiptId,
          status: detail?.status ?? 'completed',
          originalFileName: detail?.originalFileName ?? '',
          storeName: data.storeName,
          purchasedAt: data.purchasedAt ? new Date(data.purchasedAt).toISOString() : null,
          total: data.total,
          currency: detail?.currency ?? 'JPY',
          possibleDuplicateIds: detail?.possibleDuplicateIds ?? null,
          createdAt: detail?.createdAt ?? new Date().toISOString(),
        });
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : '更新に失敗しました');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">レシートを編集</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="閉じる"
          >
            <CloseIcon />
          </button>
        </div>

        {loadError ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
            <p className="text-center text-sm text-red-500">{loadError}</p>
          </div>
        ) : !detail ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
            <p className="text-center text-sm text-zinc-400 dark:text-zinc-600">読み込み中…</p>
          </div>
        ) : (
          <ReceiptDetailContent
            receipt={detail}
            editMode={true}
            isSaving={isSaving}
            error={saveError}
            onSave={handleSave}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ---- レシート行 ----

interface ReceiptRowProps {
  receipt: ListReceiptItem;
  isLast: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ReceiptRow({ receipt, isLast, onEdit, onDelete }: ReceiptRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      onDelete(receipt.id);
    });
  };

  return (
    <li className={!isLast ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}>
      <div className="flex items-center gap-1 px-4 py-3 sm:gap-2 sm:px-6 sm:py-4">
        <Link
          href={`/receipts/${receipt.id}`}
          className="flex min-w-0 flex-1 transition-colors hover:opacity-80"
        >
          {/* スマホ: 2行レイアウト。PC: 横並び */}
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
                {formatDate(receipt.purchasedAt ?? receipt.createdAt)}
              </p>
              <span className={`shrink-0 text-xs ${receipt.status === 'completed' && receipt.possibleDuplicateIds && receipt.possibleDuplicateIds.length > 0 ? 'text-amber-500' : STATUS_STYLES[receipt.status]}`}>
                {receipt.status === 'completed' && receipt.possibleDuplicateIds && receipt.possibleDuplicateIds.length > 0
                  ? '重複の可能性あり'
                  : STATUS_LABELS[receipt.status]}
              </span>
            </div>
          </div>
          <span className="ml-2 shrink-0 self-center text-zinc-300 dark:text-zinc-600">›</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(receipt.id)}
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
  const [editTargetId, setEditTargetId] = useState<string | null>(null);

  const handleSaved = (updated: ListReceiptItem) => {
    setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditTargetId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReceipt(id, backendToken);
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch {
      // 削除失敗時は行をそのまま残す
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
            onEdit={setEditTargetId}
            onDelete={handleDelete}
          />
        ))}
      </ul>

      {editTargetId && (
        <EditModal
          receiptId={editTargetId}
          backendToken={backendToken}
          onClose={() => setEditTargetId(null)}
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

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.782 4.032a.575.575 0 1 0-.813-.814L7.5 6.687 4.032 3.218a.575.575 0 0 0-.814.814L6.687 7.5l-3.469 3.468a.575.575 0 0 0 .814.814L7.5 8.313l3.469 3.469a.575.575 0 0 0 .813-.814L8.313 7.5l3.469-3.468Z"
        fill="currentColor"
      />
    </svg>
  );
}
