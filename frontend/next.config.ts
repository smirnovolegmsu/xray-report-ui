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
    // Параллельная сборка страниц (может быть отключена автоматически из-за кастомного webpack)
    // Если нужно принудительно включить, раскомментируйте следующую строку:
    // webpackBuildWorker: true,
  },
  
  // Оптимизация TypeScript
  typescript: {
    // Можно отключить проверку типов через SKIP_TYPE_CHECK=true для ускорения
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  
  // Оптимизация ESLint
  // Note: eslint config moved to eslint.config.mjs (Next.js 16+)
  // To skip ESLint during builds, use: SKIP_LINT=true npm run build
  
  // Оптимизация webpack
  // ВАЖНО: Кастомный webpack конфиг может отключить webpackBuildWorker автоматически
  // Если нужна максимальная скорость, можно упростить или убрать этот блок
  webpack: (config, { dev, isServer }) => {
    // Кеширование для ускорения повторных сборок (только для production)
    if (!dev && !isServer) {
      // Минимальные оптимизации для совместимости с webpackBuildWorker
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic', // Детерминированные ID для кеширования
        ...(config.optimization || {}),
      };
      
      // Оптимизация splitChunks только если не мешает worker режиму
      if (!process.env.DISABLE_WEBPACK_OPTIMIZATIONS) {
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
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
