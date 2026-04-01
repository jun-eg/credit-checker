import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // CloudFront → ALB 経由だと Host ヘッダーが ALB の DNS 名に書き換わり
    // Next.js の Server Action CSRF チェックが 403 を返すため許可ドメインを明示する
    serverActions: {
      allowedOrigins: ['dev.jun-eg.site', 'jun-eg.site'],
    },
  },
  async rewrites() {
    // 本番は ALB がルーティングするため不要
    // ローカル開発時（npm run dev）は NEXT_PUBLIC_BACKEND_URL に転送
    if (process.env.NODE_ENV === 'production') return [];
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
