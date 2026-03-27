import { auth } from './auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  // 未認証ユーザーをトップページにリダイレクト（ログインページ兼用）
  if (!req.auth && req.nextUrl.pathname !== '/') {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
