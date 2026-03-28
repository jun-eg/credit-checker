'use client';

import { useState } from 'react';
import { GetReceiptDetailResponse, ReceiptItemDetail, UpdateReceiptItemRequest } from '../types/receipt';

interface ViewProps {
  receipt: GetReceiptDetailResponse;
  editMode?: false;
}

interface EditProps {
  receipt: GetReceiptDetailResponse;
  editMode: true;
  isSaving: boolean;
  error?: string;
  onSave: (data: {
    storeName: string | null;
    purchasedAt: string | null;
    total: number | null;
    items: UpdateReceiptItemRequest[];
  }) => void;
  onCancel: () => void;
}

type ReceiptDetailContentProps = ViewProps | EditProps;

// 商品明細の編集ステート
interface ItemState {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

function toItemState(item: ReceiptItemDetail): ItemState {
  return {
    id: item.id,
    name: item.name,
    category: item.category ?? '',
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    totalPrice: String(item.totalPrice),
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
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

function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().slice(0, 10);
}

const inputClass =
  'rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-500';

export function ReceiptDetailContent(props: ReceiptDetailContentProps) {
  const { receipt } = props;
  const isEdit = props.editMode === true;

  const [storeName, setStoreName] = useState(receipt.storeName ?? '');
  const [purchasedAt, setPurchasedAt] = useState(toDateInputValue(receipt.purchasedAt));
  const [total, setTotal] = useState(receipt.total !== null ? String(receipt.total) : '');
  const [items, setItems] = useState<ItemState[]>(receipt.items.map(toItemState));

  const updateItem = (id: string, field: keyof Omit<ItemState, 'id' | 'name'>, value: string) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSave = () => {
    if (!isEdit) return;
    (props as EditProps).onSave({
      storeName: storeName || null,
      purchasedAt: purchasedAt || null,
      total: total !== '' ? Number(total) : null,
      items: items.map((item) => ({
        id: item.id,
        category: item.category || null,
        quantity: item.quantity !== '' ? Number(item.quantity) : undefined,
        unitPrice: item.unitPrice !== '' ? Number(item.unitPrice) : undefined,
        totalPrice: item.totalPrice !== '' ? Number(item.totalPrice) : undefined,
      })),
    });
  };

  return (
    <div className="space-y-4">
      {/* 基本情報 */}
      <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
        <div className="mb-5 space-y-3">
          {isEdit ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">店舗名</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="店舗名"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">購入日</label>
                <input
                  type="date"
                  value={purchasedAt}
                  onChange={(e) => setPurchasedAt(e.target.value)}
                  className={`w-full ${inputClass}`}
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {receipt.storeName ?? receipt.originalFileName}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatDate(receipt.purchasedAt)}</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">合計</span>
          {isEdit ? (
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0"
              min="0"
              className={`w-40 text-right text-lg font-bold tabular-nums ${inputClass}`}
            />
          ) : (
            <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatAmount(receipt.total, receipt.currency)}
            </span>
          )}
        </div>

        {isEdit && (
          <>
            {(props as EditProps).error && (
              <p className="mt-3 text-sm text-red-500">{(props as EditProps).error}</p>
            )}
            <div className="mt-5 flex justify-end gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
              <button
                onClick={(props as EditProps).onCancel}
                disabled={(props as EditProps).isSaving}
                className="rounded-lg px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={(props as EditProps).isSaving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {(props as EditProps).isSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 商品明細 */}
      {receipt.items.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-8 py-4 dark:border-zinc-800">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">商品明細</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 dark:text-zinc-600">商品名</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 dark:text-zinc-600">カテゴリ</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">数量</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">単価</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">金額</th>
              </tr>
            </thead>
            <tbody>
              {isEdit
                ? items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={idx < items.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}
                    >
                      <td className="px-6 py-3 text-sm text-zinc-900 dark:text-zinc-50">{item.name}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                          placeholder="カテゴリ"
                          className={`w-28 ${inputClass}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          min="1"
                          className={`w-16 text-right tabular-nums ${inputClass}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                          min="0"
                          className={`w-24 text-right tabular-nums ${inputClass}`}
                        />
                      </td>
                      <td className="px-6 py-2">
                        <input
                          type="number"
                          value={item.totalPrice}
                          onChange={(e) => updateItem(item.id, 'totalPrice', e.target.value)}
                          min="0"
                          className={`w-24 text-right tabular-nums ${inputClass}`}
                        />
                      </td>
                    </tr>
                  ))
                : receipt.items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={idx < receipt.items.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}
                    >
                      <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">{item.name}</td>
                      <td className="px-3 py-4 text-xs text-zinc-400 dark:text-zinc-600">{item.category ?? '—'}</td>
                      <td className="px-3 py-4 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">{item.quantity}</td>
                      <td className="px-3 py-4 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                        {formatAmount(item.unitPrice, receipt.currency)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatAmount(item.totalPrice, receipt.currency)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 解析中・失敗 */}
      {receipt.status !== 'completed' && (
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-600">
            {receipt.status === 'failed'
              ? 'レシートの解析に失敗しました'
              : '解析中です。しばらくお待ちください…'}
          </p>
        </div>
      )}
    </div>
  );
}
