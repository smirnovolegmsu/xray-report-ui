'use client';

import { useMemo, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';
import { usePortsStatus } from '@/lib/swr';
import type { PortInfo } from '@/types';

export const PortsStatus = memo(function PortsStatus() {
  // Use SWR for data fetching with automatic caching and deduplication
  const { data: portsData, isLoading: loading, error } = usePortsStatus();

  // Process data into ports array
  const ports = useMemo<PortInfo[]>(() => {
    return portsData?.ports || [];
  }, [portsData]);

  // Early returns AFTER all hooks are called
  if (loading) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs h-5 px-1.5 animate-pulse">
          <span className="font-mono">Загрузка...</span>
        </Badge>
      </div>
    );
  }

  if (error || ports.length === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge 
          variant="outline" 
          className="text-xs h-5 px-1.5 border-red-500 text-red-600 dark:text-red-400"
          title="Не удалось загрузить статус портов"
        >
          <WifiOff className="w-2.5 h-2.5 mr-0.5" />
          <span className="font-mono">Ошибка API</span>
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {ports.map((port) => (
        <Badge
          key={port.port}
          variant="outline"
          className={`text-xs h-5 px-1.5 gap-1 ${
            port.status === 'running'
              ? 'border-green-500 text-green-600 dark:text-green-400'
              : 'border-red-500 text-red-600 dark:text-red-400'
          }`}
          title={`${port.name} (${port.host})`}
        >
          {port.status === 'running' ? (
            <Wifi className="w-2.5 h-2.5" />
          ) : (
            <WifiOff className="w-2.5 h-2.5" />
          )}
          <span className="font-mono">:{port.port}</span>
        </Badge>
      ))}
    </div>
  );
});
