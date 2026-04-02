import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  output: 'standalone',
  experimental: {
    // CloudFront → ALB 経由だと Host ヘッダーが ALB の DNS 名に書き換わり
    // Next.js の Server Action CSRF チェックが 403 を返すため許可ドメインを明示する
    serverActions: {
      allowedOrigins: process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(',') ?? [],
    },
  },
  async rewrites() {
    // 本番は ALB が /api/v1/* をバックエンドに転送するため rewrite 不要
    // ローカル開発時（npm run dev）は Next.js rewrite でバックエンドにプロキシ
    if (process.env.NODE_ENV === 'production') return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
