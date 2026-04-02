'use client';

import { DragEvent, ChangeEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getReceipt, uploadReceipt } from '../../../lib/api/receipts';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type FileItemStatus = 'uploading' | 'analyzing' | 'duplicate-checking' | 'success' | 'duplicate-warning' | 'analysis-failed';

interface FileItem {
  key: string;
  fileName: string;
  status: FileItemStatus;
  receiptId?: string;
  duplicateIds?: string[];
}

type UploadState =
  | { status: 'idle' }
  | { status: 'processing'; files: FileItem[] }
  | { status: 'done'; files: FileItem[] }
  | { status: 'error'; message: string };

interface ReceiptUploadCardProps {
  backendToken: string;
  // モード固定済み: roomモードの場合はcurrentRoomを渡す、personalモードはnull
  currentRoom: { id: string; name: string } | null;
}

const TERMINAL_STATUSES: FileItemStatus[] = ['success', 'duplicate-warning', 'analysis-failed'];

export function ReceiptUploadCard({ backendToken, currentRoom }: ReceiptUploadCardProps) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateFile = (key: string, patch: Partial<Omit<FileItem, 'key'>>) => {
    setUploadState((prev) => {
      if (prev.status !== 'processing') return prev;
      const updated = prev.files.map((f) =>
        f.key === key ? { ...f, ...patch } : f,
      );
      const allDone = updated.every((f) => TERMINAL_STATUSES.includes(f.status));
      return allDone
        ? { status: 'done', files: updated }
        : { status: 'processing', files: updated };
    });
  };

  const processFile = async (file: File, key: string, roomId: string | undefined): Promise<void> => {
    try {
      const result = await uploadReceipt(file, backendToken, roomId);
      updateFile(key, { status: 'analyzing', receiptId: result.id });

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const receipt = await getReceipt(result.id, backendToken);

        if (receipt.status === 'completed') {
          updateFile(key, { status: 'duplicate-checking' });
          const hasDuplicates =
            receipt.possibleDuplicateIds !== null &&
            receipt.possibleDuplicateIds.length > 0;
          if (hasDuplicates) {
            updateFile(key, {
              status: 'duplicate-warning',
              duplicateIds: receipt.possibleDuplicateIds ?? [],
            });
          } else {
            updateFile(key, { status: 'success' });
          }
          return;
        }
        if (receipt.status === 'failed') {
          updateFile(key, { status: 'analysis-failed' });
          return;
        }
      }
      updateFile(key, { status: 'analysis-failed' });
    } catch {
      updateFile(key, { status: 'analysis-failed' });
    }
  };

  const handleFiles = (fileList: FileList) => {
    const files = Array.from(fileList).filter((f) =>
      ACCEPTED_MIME_TYPES.includes(f.type),
    );
    if (files.length === 0) return;

    const items: FileItem[] = files.map((f, i) => ({
      key: `${Date.now()}-${i}`,
      fileName: f.name,
      status: 'uploading',
    }));

    setUploadState({ status: 'processing', files: items });

    // モード固定済みのroomIdを使用
    const roomId = currentRoom?.id ?? undefined;
    files.forEach((file, i) => {
      processFile(file, items[i].key, roomId);
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
    e.target.value = '';
  };

  const reset = () => setUploadState({ status: 'idle' });
  const isProcessing = uploadState.status === 'processing';

  // 重複警告がない場合のみ完了後3秒で自動的にidle状態に戻す
  useEffect(() => {
    if (uploadState.status !== 'done') return;
    const hasDuplicateWarning = uploadState.files.some(
      (f) => f.status === 'duplicate-warning',
    );
    if (hasDuplicateWarning) return;
    const timer = setTimeout(reset, 3000);
    return () => clearTimeout(timer);
  }, [uploadState]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8 dark:bg-zinc-900">
      <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        レシートをアップロード
      </h2>

      {currentRoom && (
        <div className="mb-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            投稿先: <span className="font-medium text-zinc-700 dark:text-zinc-300">{currentRoom.name}</span>
          </p>
        </div>
      )}

      {uploadState.status === 'processing' || uploadState.status === 'done' ? (
        <div className="flex flex-col gap-3">
          {uploadState.files.map((f) => (
            <FileStatusRow key={f.key} file={f} />
          ))}
        </div>
      ) : (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="レシート画像をドロップするかクリックして選択（複数可）"
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
              isDragging
                ? 'border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-800'
                : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
            } ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              ここにドロップ、またはクリックして選択（複数可）
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              JPEG / PNG / WebP、最大 10MB
            </p>
          </div>

          {uploadState.status === 'error' && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {uploadState.message}
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleChange}
          />
        </>
      )}
    </div>
  );
}

const SPINNER = (
  <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
);

function FileStatusRow({ file }: { file: FileItem }) {
  const icons: Record<FileItemStatus, React.ReactNode> = {
    uploading: SPINNER,
    analyzing: SPINNER,
    'duplicate-checking': SPINNER,
    success: <span className="text-sm text-emerald-500">✓</span>,
    'duplicate-warning': <span className="text-sm text-amber-500">⚠</span>,
    'analysis-failed': <span className="text-sm text-red-500">✕</span>,
  };

  const labels: Record<FileItemStatus, string> = {
    uploading: 'アップロード中',
    analyzing: '解析中',
    'duplicate-checking': '重複チェック中',
    success: '完了',
    'duplicate-warning': '重複の可能性',
    'analysis-failed': '解析失敗',
  };

  const statusColor =
    file.status === 'success'
      ? 'text-emerald-500'
      : file.status === 'duplicate-warning'
      ? 'text-amber-500'
      : file.status === 'analysis-failed'
      ? 'text-red-500'
      : 'text-zinc-400 dark:text-zinc-500';

  return (
    <div className={`rounded-lg px-4 py-3 dark:bg-zinc-800 ${
      file.status === 'duplicate-warning'
        ? 'border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
        : 'bg-zinc-50'
    }`}>
      <div className="flex items-center gap-3">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          {icons[file.status]}
        </div>
        <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
          {file.fileName}
        </span>
        <span className={`shrink-0 text-xs ${statusColor}`}>
          {labels[file.status]}
        </span>
      </div>

      {file.status === 'duplicate-warning' && file.receiptId && (
        <div className="mt-2 pl-8">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            同日・同額の既存レシートが見つかりました。
          </p>
          <Link
            href={`/receipts/${file.receiptId}/duplicates`}
            className="mt-1 inline-block text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
          >
            重複を確認する →
          </Link>
        </div>
      )}
    </div>
  );
}
