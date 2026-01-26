'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { SWRConfig } from 'swr';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 5000,
          errorRetryCount: 3,
          onError: (error, key) => {
            // Don't log 401/403 errors (expected for auth)
            if (error?.response?.status === 401 || error?.response?.status === 403) {
              return;
            }
            console.error(`SWR Error [${key}]:`, error);
          },
        }}
      >
        {children}
      </SWRConfig>
      <Toaster />
    </ThemeProvider>
  );
}
