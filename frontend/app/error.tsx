'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/main-layout';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useAppStore();

  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Application error:', error);
    }
  }, [error]);

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <div className="space-y-2">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-semibold">
            {lang === 'ru' ? 'Произошла ошибка' : 'Something went wrong'}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {lang === 'ru'
              ? 'Приложение столкнулось с неожиданной ошибкой. Попробуйте обновить страницу.'
              : 'The application encountered an unexpected error. Please try refreshing the page.'}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={reset} variant="default">
            <RefreshCw className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Попробовать снова' : 'Try Again'}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'На главную' : 'Go Home'}
            </Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
