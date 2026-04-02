import { handlers } from '../../../../../auth';
import { type NextRequest } from 'next/server';

// Next.js 15+ で params が Promise になったため、await して Auth.js に渡す
// Auth.js v5 beta が古い同期形式を期待している場合でも正しくパラムを渡せるようにする
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  const params = await context.params;
  return handlers.GET(request, { params });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  const params = await context.params;
  return handlers.POST(request, { params });
}
