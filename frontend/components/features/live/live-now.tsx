'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, HardDrive } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { liveNumberFlowConfig } from '@/lib/number-flow-config';

export function LiveNow() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadNow();
    const interval = setInterval(loadNow, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadNow = async () => {
    try {
      const response = await apiClient.getLiveNow();
      setData(response.data);
      setLoading(false);
    } catch (error) {
      if (loading) {
        toast.error(handleApiError(error));
      }
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb < 1) {
      const mb = bytes / 1024 / 1024;
      if (mb < 1) {
        const kb = bytes / 1024;
        return `${kb.toFixed(1)} KB`;
      }
      return `${mb.toFixed(1)} MB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
              <div className="h-8 w-16 bg-muted animate-pulse rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const now = data?.now || {};
  const onlineUsers = now.onlineUsers || [];
  const totalConns = now.totalConns || 0;
  const totalTraffic = now.totalTraffic || 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {lang === 'ru' ? 'Онлайн пользователей' : 'Online Users'}
              </p>
              <p className="text-2xl font-bold">
                <NumberFlow 
                  value={onlineUsers.length}
                  {...liveNumberFlowConfig}
                  willChange
                />
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {lang === 'ru' ? 'Активные подключения' : 'Active Connections'}
              </p>
              <p className="text-2xl font-bold">
                <NumberFlow 
                  value={totalConns}
                  {...liveNumberFlowConfig}
                  willChange
                />
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {lang === 'ru' ? 'Текущий трафик' : 'Current Traffic'}
              </p>
              <p className="text-2xl font-bold">
                {formatBytes(totalTraffic)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {onlineUsers.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">
            {lang === 'ru' ? 'Онлайн пользователи' : 'Online Users'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {onlineUsers.map((user: string, idx: number) => (
              <Badge key={idx} variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                {user}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
