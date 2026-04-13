'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type UpdateReceiptItemRequest, ListReceiptItem, GetReceiptDetailResponse } from '../../../types/receipt';
import { getReceiptDetail, updateReceipt, deleteReceipt } from '../../../lib/api/receipts';
import { ReceiptDetailContent } from '../../../components/ReceiptDetailContent';

// RoomReceiptItemにはpossibleDuplicateIdsがないため、ReceiptListでも共通して扱えるようオプショナルに拡張
type ReceiptListItem = ListReceiptItem & { uploaderDisplayName?: string | null };

type SortField = 'date' | 'amount';
type SortDirection = 'asc' | 'desc';

interface ReceiptListProps {
  receipts: ReceiptListItem[];
  backendToken: string;
  showUploader?: boolean;
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
          categories: [...new Set((detail?.items ?? []).map((item) => item.category ?? 'その他'))],
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
  receipt: ReceiptListItem;
  isLast: boolean;
  showUploader?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ReceiptRow({ receipt, isLast, showUploader, onEdit, onDelete }: ReceiptRowProps) {
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
            {showUploader && receipt.uploaderDisplayName && (
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                {receipt.uploaderDisplayName}
              </p>
            )}
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

export function ReceiptList({ receipts: initial, backendToken, showUploader }: ReceiptListProps) {
  const router = useRouter();
  const [receipts, setReceipts] = useState(initial);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);

  // 並び替え
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // フィルター
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    receipts.forEach((r) => (r.categories ?? []).forEach((c) => cats.add(c)));
    return [...cats].sort();
  }, [receipts]);

  const filteredAndSorted = useMemo(() => {
    let result = [...receipts];

    // 期間フィルター
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((r) => {
        const d = r.purchasedAt ?? r.createdAt;
        return new Date(d).getTime() >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // 当日末まで含む
      result = result.filter((r) => {
        const d = r.purchasedAt ?? r.createdAt;
        return new Date(d).getTime() < to;
      });
    }

    // 金額フィルター
    if (amountMin) {
      const min = Number(amountMin);
      result = result.filter((r) => r.total !== null && r.total >= min);
    }
    if (amountMax) {
      const max = Number(amountMax);
      result = result.filter((r) => r.total !== null && r.total <= max);
    }

    // カテゴリフィルター
    if (selectedCategory) {
      result = result.filter((r) => (r.categories ?? []).includes(selectedCategory));
    }

    // 並び替え
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        const da = new Date(a.purchasedAt ?? a.createdAt).getTime();
        const db = new Date(b.purchasedAt ?? b.createdAt).getTime();
        cmp = da - db;
      } else {
        cmp = (a.total ?? 0) - (b.total ?? 0);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [receipts, sortField, sortDirection, dateFrom, dateTo, amountMin, amountMax, selectedCategory]);

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

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setSelectedCategory('');
  };

  const hasActiveFilters = dateFrom || dateTo || amountMin || amountMax || selectedCategory;

  if (receipts.length === 0) {
    return (
      <div className="px-8 py-12 text-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-600">レシートがありません</p>
      </div>
    );
  }

  return (
    <>
      {/* 並び替え・フィルターツールバー */}
      <div className="border-b border-zinc-100 px-4 py-3 sm:px-6 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* 並び替え */}
          <select
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('-') as [SortField, SortDirection];
              setSortField(field);
              setSortDirection(dir);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="date-desc">日付（新しい順）</option>
            <option value="date-asc">日付（古い順）</option>
            <option value="amount-desc">金額（高い順）</option>
            <option value="amount-asc">金額（低い順）</option>
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
              hasActiveFilters
                ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400'
                : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <FilterIcon /> フィルター{hasActiveFilters ? ' (適用中)' : ''}
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              クリア
            </button>
          )}

          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-600">
            {filteredAndSorted.length}/{receipts.length}件
          </span>
        </div>

        {/* フィルターパネル */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* 期間 */}
            <div>
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">表示期間</label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                />
                <span className="text-xs text-zinc-400">〜</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                />
              </div>
            </div>

            {/* 金額 */}
            <div>
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">金額</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="下限"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                />
                <span className="text-xs text-zinc-400">〜</span>
                <input
                  type="number"
                  placeholder="上限"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                />
              </div>
            </div>

            {/* カテゴリ */}
            <div>
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">カテゴリ</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <option value="">すべて</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {filteredAndSorted.length === 0 ? (
        <div className="px-8 py-12 text-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-600">条件に一致するレシートがありません</p>
        </div>
      ) : (
        <ul>
          {filteredAndSorted.map((receipt, idx) => (
            <ReceiptRow
              key={receipt.id}
              receipt={receipt}
              isLast={idx === filteredAndSorted.length - 1}
              showUploader={showUploader}
              onEdit={setEditTargetId}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

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

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1 inline-block">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}
