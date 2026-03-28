'use client';

import { DragEvent, ChangeEvent, useEffect, useRef, useState } from 'react';
import { getReceipt, uploadReceipt } from '../../../lib/api/receipts';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type FileItemStatus = 'uploading' | 'analyzing' | 'success' | 'analysis-failed';

interface FileItem {
  key: string;
  fileName: string;
  status: FileItemStatus;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'processing'; files: FileItem[] }
  | { status: 'done'; files: FileItem[] }
  | { status: 'error'; message: string };

interface ReceiptUploadCardProps {
  backendToken: string;
}

export function ReceiptUploadCard({ backendToken }: ReceiptUploadCardProps) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateFileStatus = (key: string, status: FileItemStatus) => {
    setUploadState((prev) => {
      if (prev.status !== 'processing') return prev;
      const updated = prev.files.map((f) =>
        f.key === key ? { ...f, status } : f,
      );
      const allDone = updated.every(
        (f) => f.status === 'success' || f.status === 'analysis-failed',
      );
      return allDone
        ? { status: 'done', files: updated }
        : { status: 'processing', files: updated };
    });
  };

  const processFile = async (file: File, key: string): Promise<void> => {
    try {
      const result = await uploadReceipt(file, backendToken);
      updateFileStatus(key, 'analyzing');

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const receipt = await getReceipt(result.id, backendToken);
        if (receipt.status === 'completed') {
          updateFileStatus(key, 'success');
          return;
        }
        if (receipt.status === 'failed') {
          updateFileStatus(key, 'analysis-failed');
          return;
        }
      }
      updateFileStatus(key, 'analysis-failed');
    } catch {
      updateFileStatus(key, 'analysis-failed');
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

    files.forEach((file, i) => {
      processFile(file, items[i].key);
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

  // 完了後3秒で自動的にidle状態に戻す
  useEffect(() => {
    if (uploadState.status !== 'done') return;
    const timer = setTimeout(reset, 3000);
    return () => clearTimeout(timer);
  }, [uploadState.status]);

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
      <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        レシートをアップロード
      </h2>

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

function FileStatusRow({ file }: { file: FileItem }) {
  const icons: Record<FileItemStatus, React.ReactNode> = {
    uploading: (
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
    ),
    analyzing: (
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
    ),
    success: (
      <span className="text-sm text-emerald-500">✓</span>
    ),
    'analysis-failed': (
      <span className="text-sm text-red-500">✕</span>
    ),
  };

  const labels: Record<FileItemStatus, string> = {
    uploading: 'アップロード中',
    analyzing: '解析中',
    success: '完了',
    'analysis-failed': '解析失敗',
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
      <div className="flex h-5 w-5 items-center justify-center">
        {icons[file.status]}
      </div>
      <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
        {file.fileName}
      </span>
      <span className={`text-xs ${
        file.status === 'success'
          ? 'text-emerald-500'
          : file.status === 'analysis-failed'
          ? 'text-red-500'
          : 'text-zinc-400 dark:text-zinc-500'
      }`}>
        {labels[file.status]}
      </span>
    </div>
  );
}
