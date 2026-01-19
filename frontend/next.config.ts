import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Для production деплоя
  
  // Proxy API requests к Flask backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8787/api/:path*',
      },
    ];
  },
  
  // Оптимизация
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
