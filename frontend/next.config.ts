import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // npmワークスペース構成でTurbopackがnode_modulesを解決できるようにルートを指定
  turbopack: {
    root: '../',
  },
};

export default nextConfig;
