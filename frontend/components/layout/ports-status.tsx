'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Server, Wifi, WifiOff } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { devLog } from '@/lib/utils';

interface PortInfo {
  port: number;
  name: string;
  type: string;
  status: string;
  host: string;
}

interface PortsData {
  ports: PortInfo[];
  current: {
    port: number;
    host: string;
    url: string;
  };
  timestamp: string;
}

export function PortsStatus() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadPorts();
    // Refresh every 10 seconds
    const interval = setInterval(loadPorts, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadPorts = async () => {
    try {
      const response = await apiClient.getPortsStatus();
      if (response.data && response.data.ok) {
        setPorts(response.data.ports || []);
        setError(false);
      } else {
        setError(true);
      }
    } catch (err) {
      // Silent fail - don't show toast on every refresh
      devLog.error('Failed to load ports:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

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
}
