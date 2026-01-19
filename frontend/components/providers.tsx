'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { ConnectionError } from '@/components/ui/connection-error';

function ApiStatusChecker({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const checkApi = async () => {
    try {
      await apiClient.ping();
      setStatus('connected');
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error?.message || 'Connection failed');
    }
  };

  useEffect(() => {
    checkApi();
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Подключение к серверу...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return <ConnectionError error={errorMessage} onRetry={checkApi} />;
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ApiStatusChecker>
        {children}
      </ApiStatusChecker>
      <Toaster />
    </ThemeProvider>
  );
}
