import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // 本番は nginx がルーティングするため不要
    // ローカル開発時（npm run dev）は localhost:3003 に転送
    if (process.env.NODE_ENV === 'production') return [];
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:3003/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
