'use client';

import { DragEvent, ChangeEvent, useRef, useState } from 'react';
import { getReceipt, uploadReceipt } from '../../../lib/api/receipts';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'analyzing'; fileName: string }
  | { status: 'success'; receiptId: string; fileName: string }
  | { status: 'analysis-failed'; fileName: string }
  | { status: 'error'; message: string };

interface ReceiptUploadCardProps {
  backendToken: string;
}

export function ReceiptUploadCard({ backendToken }: ReceiptUploadCardProps) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pollUntilAnalyzed = async (
    receiptId: string,
    fileName: string,
  ): Promise<void> => {
    setUploadState({ status: 'analyzing', fileName });

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const receipt = await getReceipt(receiptId, backendToken);
      if (receipt.status === 'completed') {
        setUploadState({ status: 'success', receiptId, fileName });
        return;
      }
      if (receipt.status === 'failed') {
        setUploadState({ status: 'analysis-failed', fileName });
        return;
      }
    }
    // タイムアウト：解析が完了していないことをユーザーに伝える
    setUploadState({ status: 'analysis-failed', fileName });
  };

  const handleFile = async (file: File) => {
    setUploadState({ status: 'uploading' });
    try {
      const result = await uploadReceipt(file, backendToken);
      await pollUntilAnalyzed(result.id, result.originalFileName);
    } catch (error) {
      setUploadState({
        status: 'error',
        message: error instanceof Error ? error.message : 'アップロードに失敗しました',
      });
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const reset = () => setUploadState({ status: 'idle' });
  const isLoading =
    uploadState.status === 'uploading' || uploadState.status === 'analyzing';

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
      <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        レシートをアップロード
      </h2>

      {uploadState.status === 'analysis-failed' ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">{uploadState.fileName}</span> の解析に失敗しました
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            画像は保存済みです。時間をおいて再度お試しください
          </p>
          <button
            onClick={reset}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            別の画像をアップロード
          </button>
        </div>
      ) : uploadState.status === 'analyzing' ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">{uploadState.fileName}</span> を解析中...
          </p>
        </div>
      ) : uploadState.status === 'success' ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">{uploadState.fileName}</span> の解析が完了しました
          </p>
          <button
            onClick={reset}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            続けてアップロード
          </button>
        </div>
      ) : (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="レシート画像をドロップするかクリックして選択"
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
              isDragging
                ? 'border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-800'
                : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
            } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {uploadState.status === 'uploading'
                ? 'アップロード中...'
                : 'ここにドロップ、またはクリックして選択'}
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
            className="hidden"
            onChange={handleChange}
          />
        </>
      )}
    </div>
  );
}
