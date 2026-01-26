'use client';

import { useEffect, useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { handleApiError, devLog } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type { EventsStats as EventsStatsType, Event } from '@/types';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface EventsStatsSidebarProps {
  hours?: number;
  events?: Event[];
  onTypeClick?: (type: string) => void;
}

export function EventsStatsSidebar({ hours = 24, events = [], onTypeClick }: EventsStatsSidebarProps) {
  const [stats, setStats] = useState<EventsStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [hours]);

  const loadStats = async () => {
    try {
      const response = await apiClient.getEventsStats(hours);
      if (response?.data) {
        setStats(response.data as EventsStatsType);
      }
      setLoading(false);
    } catch (error) {
      const errorMessage = handleApiError(error);
      if (loading) {
        toast.error(lang === 'ru'
          ? `Ошибка загрузки статистики: ${errorMessage}`
          : `Failed to load statistics: ${errorMessage}`
        );
      }
      setLoading(false);
      devLog.error('Failed to load stats:', error);
    }
  };

  // Calculate services status from events
  const servicesStatus = useMemo(() => {
    const services = new Map<string, { status: 'up' | 'down' | 'slow'; lastSeen: Date }>();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    // Process SERVICE_HEALTH events
    events
      .filter(e => e.type === 'SERVICE_HEALTH')
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .forEach(e => {
        const serviceName = e.service || 'unknown';
        if (!services.has(serviceName)) {
          let status: 'up' | 'down' | 'slow' = 'up';
          if (e.action?.includes('service_down')) status = 'down';
          else if (e.action?.includes('service_slow')) status = 'slow';
          services.set(serviceName, { status, lastSeen: new Date(e.ts) });
        }
      });

    return Array.from(services.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        isRecent: data.lastSeen.getTime() >= fiveMinutesAgo,
      }))
      .slice(0, 6);
  }, [events]);

  if (loading || !stats) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-16"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats - Ultra Compact */}
      <div>
        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {lang === 'ru' ? 'Сводка' : 'Summary'}
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-muted-foreground">{lang === 'ru' ? 'Всего' : 'Total'}</span>
            <span className="text-sm font-semibold ml-auto">{stats.total}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-muted-foreground">{lang === 'ru' ? 'Ошиб.' : 'Err'}</span>
            <span className="text-sm font-semibold ml-auto text-red-600 dark:text-red-400">{stats.errors}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs text-muted-foreground">{lang === 'ru' ? 'Пред.' : 'Warn'}</span>
            <span className="text-sm font-semibold ml-auto text-yellow-600 dark:text-yellow-400">{stats.warnings}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">Info</span>
            <span className="text-sm font-semibold ml-auto">{stats.info}</span>
          </div>
        </div>
      </div>

      {/* By Type - Clickable */}
      {Object.keys(stats.byType).length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {lang === 'ru' ? 'По типам' : 'By Type'}
          </h4>
          <div className="space-y-1">
            {Object.entries(stats.byType)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 6)
              .map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => onTypeClick?.(type)}
                  className="flex items-center justify-between w-full text-[11px] py-0.5 px-1 rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground truncate">{type}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1">
                    {count}
                  </Badge>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Services Status */}
      {servicesStatus.length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {lang === 'ru' ? 'Сервисы' : 'Services'}
          </h4>
          <div className="space-y-1">
            {servicesStatus.map(({ name, status, isRecent }) => (
              <div key={name} className="flex items-center gap-1.5 text-[11px]">
                {status === 'down' ? (
                  <XCircle className={`w-3 h-3 ${isRecent ? 'text-red-500 animate-pulse' : 'text-red-400'}`} />
                ) : status === 'slow' ? (
                  <AlertTriangle className={`w-3 h-3 ${isRecent ? 'text-yellow-500' : 'text-yellow-400'}`} />
                ) : (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                )}
                <span className={`truncate ${status === 'down' && isRecent ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
