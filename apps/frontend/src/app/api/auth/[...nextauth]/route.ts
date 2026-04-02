import { handlers } from '../../../../../auth';
import { NextRequest } from 'next/server';

// Next.js はbasePath(/credit-checker)をrequest.urlから除去するため、
// AUTH_URL.pathnameとのマッチに失敗しAuth.jsがUnknownActionエラーを起こす。
// リクエストURLにbasePath相当のパスを補完することで正しくアクション解析させる。
function restoreBasePath(request: NextRequest): NextRequest {
  const authUrl = process.env.AUTH_URL;
  if (!authUrl) return request;

  const basePath = new URL(authUrl).pathname.replace(/\/api\/auth$/, '');
  if (!basePath) return request;

  const url = new URL(request.url);
  if (!url.pathname.startsWith(basePath)) {
    url.pathname = basePath + url.pathname;
    return new NextRequest(url.toString(), request);
  }
  return request;
}

export async function GET(request: NextRequest) {
  return handlers.GET(restoreBasePath(request));
}

export async function POST(request: NextRequest) {
  return handlers.POST(restoreBasePath(request));
}
