'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { GetReceiptDetailResponse, ReceiptItemDetail, UpdateReceiptItemRequest } from '../types/receipt';
import { getReceiptImageUrl } from '../lib/api/receipts';

interface ViewProps {
  receipt: GetReceiptDetailResponse;
  editMode?: false;
  token?: string;
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

const CATEGORIES = [
  '食費',
  '日用品',
  '交通費',
  '外食',
  '医療・薬',
  '衣類・ファッション',
  '娯楽・趣味',
  '電子機器',
  'その他',
] as const;

// 商品明細の編集ステート
interface ItemState {
  localId: string;  // React key兼ローカル識別子（新規アイテムはUUID生成、既存はbackend id）
  backendId?: string; // バックエンドのid（新規アイテムはundefined）
  name: string;
  category: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

function toItemState(item: ReceiptItemDetail): ItemState {
  return {
    localId: item.id,
    backendId: item.id,
    name: item.name,
    category: item.category ?? '',
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    totalPrice: String(item.totalPrice),
  };
}

function newItemState(): ItemState {
  return {
    localId: crypto.randomUUID(),
    backendId: undefined,
    name: '',
    category: '',
    quantity: '1',
    unitPrice: '0',
    totalPrice: '0',
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
  const token = !isEdit ? (props as ViewProps).token : undefined;

  const [storeName, setStoreName] = useState(receipt.storeName ?? '');
  const [purchasedAt, setPurchasedAt] = useState(toDateInputValue(receipt.purchasedAt));
  const [items, setItems] = useState<ItemState[]>(receipt.items.map(toItemState));

  // receipt.id と token の組み合わせをキーに、取得結果をまとめて管理する
  // ローディング状態はキーの一致/不一致から派生させることで effect 内の setState を不要にする
  const [imageFetch, setImageFetch] = useState<{
    key: string | null;
    url: string | null;
    error: boolean;
  }>({ key: null, url: null, error: false });
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const imageFetchKey = token ? `${receipt.id}:${token}` : null;
  const imageUrl = imageFetch.key === imageFetchKey ? imageFetch.url : null;
  const imageStatus: 'idle' | 'loading' | 'error' =
    imageFetch.error && imageFetch.key === imageFetchKey
      ? 'error'
      : imageFetchKey !== null && imageFetch.key !== imageFetchKey
        ? 'loading'
        : 'idle';

  useEffect(() => {
    if (!token) return;
    const fetchKey = `${receipt.id}:${token}`;
    let objectUrl: string | null = null;
    getReceiptImageUrl(receipt.id, token)
      .then((url) => {
        objectUrl = url;
        setImageFetch({ key: fetchKey, url, error: false });
      })
      .catch(() => setImageFetch({ key: fetchKey, url: null, error: true }));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [receipt.id, token]);

  const updateItem = (
    localId: string,
    field: 'name' | 'category' | 'quantity' | 'unitPrice',
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item;
        const updated = { ...item, [field]: value };
        // 数量・単価のどちらかが変わったら金額を自動計算
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = field === 'quantity' ? Number(value) : Number(item.quantity);
          const price = field === 'unitPrice' ? Number(value) : Number(item.unitPrice);
          updated.totalPrice = !isNaN(qty) && !isNaN(price) ? String(qty * price) : item.totalPrice;
        }
        return updated;
      }),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, newItemState()]);
  };

  const removeItem = (localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId));
  };

  // 商品明細の合計を自動計算
  const computedTotal = items.reduce((sum, item) => {
    const tp = Number(item.totalPrice);
    return sum + (isNaN(tp) ? 0 : tp);
  }, 0);

  const handleSave = () => {
    if (!isEdit) return;
    (props as EditProps).onSave({
      storeName: storeName || null,
      purchasedAt: purchasedAt || null,
      total: computedTotal,
      items: items.map((item) => ({
        ...(item.backendId ? { id: item.backendId } : {}),
        name: item.name || undefined,
        category: item.category || null,
        quantity: item.quantity !== '' ? Number(item.quantity) : undefined,
        unitPrice: item.unitPrice !== '' ? Number(item.unitPrice) : undefined,
        totalPrice: item.totalPrice !== '' ? Number(item.totalPrice) : undefined,
      })),
    });
  };

  return (
    <div className="space-y-4">
      {/* 重複候補の警告 */}
      {!isEdit && receipt.possibleDuplicateIds && receipt.possibleDuplicateIds.length > 0 && (
        <a
          href={`/receipts/${receipt.id}/duplicates`}
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900"
        >
          <span className="mt-0.5 shrink-0 text-amber-500">
            <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.4449 0.608765C8.0183 -0.107015 6.9817 -0.107015 6.55509 0.608765L0.161178 11.3368C-0.265339 12.0526 0.253171 12.9999 1.10608 12.9999H13.8939C14.7468 12.9999 15.2653 12.0526 14.8388 11.3368L8.4449 0.608765ZM7.4999 5.49991C7.7761 5.49991 7.9999 5.72376 7.9999 5.99991V8.49991C7.9999 8.77606 7.7761 8.99991 7.4999 8.99991C7.2238 8.99991 6.9999 8.77606 6.9999 8.49991V5.99991C6.9999 5.72376 7.2238 5.49991 7.4999 5.49991ZM7.4999 11.3749C7.1857 11.3749 6.9374 11.1266 6.9374 10.8124C6.9374 10.4982 7.1857 10.2499 7.4999 10.2499C7.8141 10.2499 8.0624 10.4982 8.0624 10.8124C8.0624 11.1266 7.8141 11.3749 7.4999 11.3749Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              重複の可能性があるレシートが見つかりました
            </p>
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
              タップして重複を確認する →
            </p>
          </div>
        </a>
      )}

      {/* レシート画像 */}
      {token && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          {imageStatus === 'loading' && (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-zinc-400 dark:text-zinc-600">画像を読み込み中…</p>
            </div>
          )}
          {imageStatus === 'error' && (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-red-400">画像の取得に失敗しました</p>
            </div>
          )}
          {imageUrl && (
            <button
              onClick={() => setIsImageModalOpen(true)}
              className="block w-full"
              aria-label="レシート画像を拡大表示"
            >
              <Image
                src={imageUrl}
                alt="レシート画像"
                width={800}
                height={1200}
                unoptimized
                className="max-h-64 w-full object-contain"
              />
            </button>
          )}
        </div>
      )}

      {/* 画像フルスクリーンモーダル */}
      {isImageModalOpen && imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <Image
            src={imageUrl}
            alt="レシート画像"
            width={800}
            height={1200}
            unoptimized
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}

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
            <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatAmount(computedTotal, receipt.currency)}
            </span>
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
      {(isEdit || receipt.items.length > 0) && (
        <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 sm:px-6 dark:border-zinc-800">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">商品明細</h3>
            {isEdit && (
              <button
                onClick={addItem}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <span>＋</span>
                <span>商品を追加</span>
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 dark:text-zinc-600">商品名</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 dark:text-zinc-600">カテゴリ</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">数量</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">単価</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 dark:text-zinc-600">金額</th>
                {isEdit && <th className="w-8 py-3" />}
              </tr>
            </thead>
            <tbody>
              {isEdit
                ? items.map((item, idx) => (
                    <tr
                      key={item.localId}
                      className={idx < items.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(item.localId, 'name', e.target.value)}
                          placeholder="商品名"
                          className={`w-full min-w-24 ${inputClass}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item.localId, 'category', e.target.value)}
                          className={`w-32 ${inputClass}`}
                        >
                          <option value="">—</option>
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.localId, 'quantity', e.target.value)}
                          min="1"
                          className={`w-16 text-right tabular-nums ${inputClass}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.localId, 'unitPrice', e.target.value)}
                          min="0"
                          className={`w-24 text-right tabular-nums ${inputClass}`}
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatAmount(item.totalPrice !== '' ? Number(item.totalPrice) : null, receipt.currency)}
                      </td>
                      <td className="py-2 pr-2">
                        <button
                          onClick={() => removeItem(item.localId)}
                          className="rounded-md p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                          aria-label="削除"
                        >
                          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M11.782 4.032a.575.575 0 1 0-.813-.814L7.5 6.687 4.032 3.218a.575.575 0 0 0-.814.814L6.687 7.5l-3.469 3.468a.575.575 0 0 0 .814.814L7.5 8.313l3.469 3.469a.575.575 0 0 0 .813-.814L8.313 7.5l3.469-3.468Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                : receipt.items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={idx < receipt.items.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}
                    >
                      <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-50">{item.name}</td>
                      <td className="px-3 py-4 text-xs text-zinc-400 dark:text-zinc-600">{item.category ?? '—'}</td>
                      <td className="px-3 py-4 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">{item.quantity}</td>
                      <td className="px-3 py-4 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                        {formatAmount(item.unitPrice, receipt.currency)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatAmount(item.totalPrice, receipt.currency)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          </div>
          {isEdit && items.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
              商品がありません。「商品を追加」で追加してください。
            </p>
          )}
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
