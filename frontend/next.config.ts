import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  // Proxy API requests к Flask backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8787/api/:path*',
      },
    ];
  },
  
  // Удаляем console.log в production для оптимизации
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Оптимизация для слабого сервера
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@nivo/bar', '@nivo/line', '@nivo/core', 'date-fns'],
  },
  
  // Пропускаем проверку типов для быстрой сборки
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ОТКЛЮЧИТЬ source maps в production (экономия ~40% размера)
  productionBrowserSourceMaps: false,
  
  // Webpack оптимизации
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Оптимизация чанков для меньшего размера
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            nivo: {
              test: /[\\/]node_modules[\\/]@nivo[\\/]/,
              name: 'nivo',
              priority: 30,
              reuseExistingChunk: true,
            },
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix',
              priority: 20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
