'use client';

import { useEffect, useState } from 'react';

type BrowserState = 'loading' | 'normal' | 'android-webview' | 'ios-inapp';

export function LoginCard() {
  const [browserState, setBrowserState] = useState<BrowserState>('loading');

  useEffect(() => {
    const ua = navigator.userAgent;
    const isAndroidWebView = /\bwv\b/.test(ua);
    const isIosWebView = /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua);

    if (isAndroidWebView) {
      // intent スキームで Chrome に自動リダイレクト
      const { host, pathname, search } = location;
      window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
      setBrowserState('android-webview');
    } else if (isIosWebView) {
      setBrowserState('ios-inapp');
    } else {
      setBrowserState('normal');
    }
  }, []);

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
          <a
            href="/api/auth/signin/google?callbackUrl=/dashboard"
            className="flex items-center gap-3 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Google でログイン
          </a>
        </>
      )}
    </div>
  );
}
