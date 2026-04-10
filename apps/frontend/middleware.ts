import { auth } from './auth';
import { NextResponse } from 'next/server';
import nextConfig from './next.config';

// Auth.js の reqWithEnvURL が nextConfig を落とすため
// req.nextUrl.basePath が空、pathname に basePath が残る場合がある。
// next.config.ts から直接読み込んで両方を自前で処理する。
const BASE_PATH = nextConfig.basePath ?? '';
const PUBLIC_PATHS = ['/', '/select'];

export default auth((req) => {
  const raw = req.nextUrl.pathname;
  const pathname = raw.startsWith(BASE_PATH)
    ? raw.slice(BASE_PATH.length) || '/'
    : raw;

  const redirect = (path: string) =>
    NextResponse.redirect(new URL(`${BASE_PATH}${path}`, req.url));

  // 未認証: ログインページ以外はトップへ
  if (!req.auth && pathname !== '/') {
    return redirect('/');
  }

  // 認証済みでログインページ → select へ
  if (req.auth && pathname === '/') {
    return redirect('/select');
  }

  // 認証済み・モード未選択・保護ページ → select へ
  const modeCookie = req.cookies.get('app-mode');
  if (req.auth && !PUBLIC_PATHS.includes(pathname) && !modeCookie?.value) {
    return redirect('/select');
  }
});

export const config = {
  matcher: ['/((?!api/auth|api/backend|_next/static|_next/image|favicon.ico).*)'],
};
