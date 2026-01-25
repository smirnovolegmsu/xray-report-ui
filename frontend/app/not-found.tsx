'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/main-layout';
import { Home, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function NotFound() {
  const { lang } = useAppStore();

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-semibold">
            {lang === 'ru' ? 'Страница не найдена' : 'Page Not Found'}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {lang === 'ru'
              ? 'Запрашиваемая страница не существует или была перемещена.'
              : 'The page you are looking for does not exist or has been moved.'}
          </p>
        </div>

        <div className="flex gap-3">
          <Button asChild variant="default">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'На главную' : 'Go Home'}
            </Link>
          </Button>
          <Button asChild variant="outline" onClick={() => window.history.back()}>
            <Link href="#">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Назад' : 'Go Back'}
            </Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
