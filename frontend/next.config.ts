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
  
  // Оптимизация компилятора
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Ускорение сборки
  experimental: {
    // Используем SWC для минификации (быстрее чем Terser)
    optimizeCss: true,
    // Оптимизация производительности
    optimizePackageImports: ['lucide-react', '@nivo/bar', '@nivo/line', '@nivo/core', 'recharts'],
  },
  
  // Оптимизация TypeScript
  typescript: {
    // Можно отключить проверку типов через SKIP_TYPE_CHECK=true для ускорения
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  
  // Оптимизация ESLint
  // Note: eslint config moved to eslint.config.mjs (Next.js 16+)
  // To skip ESLint during builds, use: SKIP_LINT=true npm run build
  
  // Оптимизация webpack для лучшего code splitting
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Оптимизация для production
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        ...(config.optimization || {}),
      };
      
      // Улучшенный code splitting для тяжелых библиотек
      if (!process.env.DISABLE_WEBPACK_OPTIMIZATIONS) {
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Отдельный чанк для тяжелых библиотек графиков
            charts: {
              name: 'charts',
              test: /[\\/]node_modules[\\/](@nivo|recharts)[\\/]/,
              chunks: 'all',
              priority: 30,
              reuseExistingChunk: true,
            },
            // Отдельный чанк для UI библиотек
            ui: {
              name: 'ui',
              test: /[\\/]node_modules[\\/](@radix-ui|framer-motion)[\\/]/,
              chunks: 'all',
              priority: 25,
              reuseExistingChunk: true,
            },
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]/,
              priority: 20,
              reuseExistingChunk: true,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        };
      }
    }
    
    return config;
  },
};

export default nextConfig;
