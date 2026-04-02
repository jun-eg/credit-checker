import { auth } from './auth';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/select'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // 未認証: ログインページ以外はトップへ
  if (!req.auth && pathname !== '/') {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // 認証済みでログインページ → select へ
  if (req.auth && pathname === '/') {
    return NextResponse.redirect(new URL('/select', req.nextUrl));
  }

  // 認証済み・モード未選択・保護ページ → select へ
  const modeCookie = req.cookies.get('app-mode');
  if (req.auth && !PUBLIC_PATHS.includes(pathname) && !modeCookie?.value) {
    return NextResponse.redirect(new URL('/select', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!api/auth|api/backend|_next/static|_next/image|favicon.ico).*)'],
};
