'use client';

import { useEffect, useSyncExternalStore } from 'react';

type BrowserState = 'loading' | 'normal' | 'android-webview' | 'ios-inapp';

type Props = {
  signIn: () => Promise<void>;
};

function detectBrowserState(): BrowserState {
  const ua = navigator.userAgent;
  if (/\bwv\b/.test(ua)) return 'android-webview';
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) return 'ios-inapp';
  return 'normal';
}

// 外部ストアへの購読なし（ブラウザ判定は不変）
const subscribeToNothing = () => () => {};

export function LoginCard({ signIn }: Props) {
  // useSyncExternalStore でSSR時は 'loading'、クライアント側は実際の状態を返す
  const browserState = useSyncExternalStore(
    subscribeToNothing,
    detectBrowserState,
    () => 'loading' as BrowserState,
  );

  useEffect(() => {
    if (browserState !== 'android-webview') return;
    // intent スキームで Chrome に自動リダイレクト
    const { host, pathname, search } = location;
    window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
  }, [browserState]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl bg-white p-8 shadow-sm sm:p-12 dark:bg-zinc-900">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Credit Checker
      </h1>

      {browserState === 'loading' && null}

      {browserState === 'android-webview' && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          ブラウザを起動しています…
        </p>
      )}

      {browserState === 'ios-inapp' && (
        <div className="flex flex-col gap-3 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          <p className="font-medium">アプリ内ブラウザではGoogleログインが使用できません</p>
          <p>Safariで開いてから再度ログインしてください。</p>
          <p className="text-xs">右下の共有ボタン →「Safariで開く」</p>
        </div>
      )}

      {browserState === 'normal' && (
        <>
          <p className="text-zinc-500 dark:text-zinc-400">
            レシートを管理して支出を把握しよう
          </p>
          <form action={signIn}>
            <button
              type="submit"
              className="flex items-center gap-3 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Google でログイン
            </button>
          </form>
        </>
      )}
    </div>
  );
}
