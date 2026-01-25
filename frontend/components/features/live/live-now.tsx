'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, HardDrive, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError, devLog, formatBytes } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { liveNumberFlowConfig } from '@/lib/number-flow-config';
import type { User } from '@/types';
import { getCardColorClasses } from '@/lib/card-colors';
import { useTr } from '@/lib/i18n';

export const LiveNow = memo(function LiveNow() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [hourStats, setHourStats] = useState<any>(null);
  const { lang } = useAppStore();
  const tr = useTr();

  const loadUsers = useCallback(async () => {
    try {
      const response = await apiClient.getUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      devLog.error('Failed to load users:', error);
    }
  }, []);

  const loadNow = useCallback(async () => {
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
  }, [loading]);

  const loadHourStats = useCallback(async () => {
    try {
      const response = await apiClient.getLiveSeries({
        metric: 'online_users',
        period: '3600',
        gran: '300',
        scope: 'global',
      });
      if (response.data.series && response.data.series.length > 0) {
        const series = response.data.series;
        const latest = series[series.length - 1]?.value || 0;
        const previous = series[series.length - 2]?.value || 0;
        const max = Math.max(...series.map((s: any) => s.value || 0));
        const min = Math.min(...series.map((s: any) => s.value || 0));
        const avg = series.reduce((sum: number, s: any) => sum + (s.value || 0), 0) / series.length;
        
        setHourStats({
          current: latest,
          previous,
          max,
          min,
          avg: Math.round(avg),
          trend: latest > previous ? 'up' : latest < previous ? 'down' : 'stable',
        });
      }
    } catch (error) {
      devLog.error('Failed to load hour stats:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadNow();
    loadHourStats();
    const interval = setInterval(() => {
      loadNow();
      loadHourStats();
    }, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [loadUsers, loadNow, loadHourStats]);

  const getUserDisplayName = useCallback((uuid: string): string => {
    const user = users.find(u => u.uuid === uuid || u.email === uuid);
    if (!user) return uuid;
    return user.alias || user.email || uuid;
  }, [users]);

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
  const totalConns = now.conns || 0;
  const totalTraffic = now.trafficBytes || 0;

  return (
    <Card className="p-3 md:p-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        {/* Online Users */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 ${getCardColorClasses('blue').bg} rounded-lg flex items-center justify-center shrink-0`}>
            <Users className={`w-4 h-4 ${getCardColorClasses('blue').text}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {tr('Онлайн', 'Online')}
            </p>
            <p className="text-xl font-bold">
              <NumberFlow 
                value={onlineUsers.length}
                {...liveNumberFlowConfig}
                willChange
              />
            </p>
          </div>
        </div>

        {/* Active Connections */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 ${getCardColorClasses('green').bg} rounded-lg flex items-center justify-center shrink-0`}>
            <Activity className={`w-4 h-4 ${getCardColorClasses('green').text}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {tr('Подключения', 'Connections')}
            </p>
            <p className="text-xl font-bold">
              <NumberFlow 
                value={totalConns}
                {...liveNumberFlowConfig}
                willChange
              />
            </p>
          </div>
        </div>

        {/* Current Traffic */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 ${getCardColorClasses('purple').bg} rounded-lg flex items-center justify-center shrink-0`}>
            <HardDrive className={`w-4 h-4 ${getCardColorClasses('purple').text}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {tr('Трафик', 'Traffic')}
            </p>
            <p className="text-xl font-bold truncate">
              {formatBytes(totalTraffic) as string}
            </p>
          </div>
        </div>

        {/* Hour Stats */}
        {hourStats && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/20 rounded-lg flex items-center justify-center shrink-0">
              {hourStats.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />}
              {hourStats.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />}
              {hourStats.trend === 'stable' && <Minus className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {lang === 'ru' ? 'Среднее/ч' : 'Avg/h'}
              </p>
              <p className="text-xl font-bold">
                {hourStats.avg} <span className="text-xs text-muted-foreground">({hourStats.min}-{hourStats.max})</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Online Users List */}
      {onlineUsers.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex flex-wrap gap-1.5">
            {onlineUsers.map((user: string, idx: number) => (
              <Badge key={idx} variant="outline" className="gap-1 text-xs h-6 px-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                {getUserDisplayName(user)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
});
