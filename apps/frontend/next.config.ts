import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // 本番は nginx がルーティングするため不要
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
