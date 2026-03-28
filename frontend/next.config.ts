import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // npmワークスペース構成でTurbopackがnext/package.jsonを解決できるようにルートを指定
  turbopack: {
    root: '../',
  },
};

export default nextConfig;
