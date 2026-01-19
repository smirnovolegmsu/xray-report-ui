'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { handleApiError } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type { EventsStats as EventsStatsType, Event } from '@/types';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingUp,
} from 'lucide-react';
import { getCardColorClasses } from '@/lib/card-colors';
import { useTr } from '@/lib/i18n';

interface EventsStatsProps {
  hours?: number;
}

export function EventsStats({ hours = 24 }: EventsStatsProps) {
  const [stats, setStats] = useState<EventsStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();
  const tr = useTr();

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [hours]);

  const loadStats = async () => {
    try {
      const response = await apiClient.getEventsStats(hours);
      setStats(response.data as EventsStatsType);
      setLoading(false);
    } catch (error) {
      if (loading) {
        toast.error(handleApiError(error));
      }
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-8 bg-muted rounded w-16"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: lang === 'ru' ? 'Всего событий' : 'Total Events',
      value: stats.total,
      icon: Activity,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-950',
      colorScheme: 'blue' as const,
    },
    {
      title: lang === 'ru' ? 'Ошибки' : 'Errors',
      value: stats.errors,
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-950',
      colorScheme: 'red' as const,
    },
    {
      title: lang === 'ru' ? 'Предупреждения' : 'Warnings',
      value: stats.warnings,
      icon: AlertTriangle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-950',
      colorScheme: 'yellow' as const,
    },
    {
      title: lang === 'ru' ? 'Информация' : 'Info',
      value: stats.info,
      icon: Info,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-950',
      colorScheme: 'green' as const,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const colors = getCardColorClasses(card.colorScheme);
          return (
            <Card key={idx} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-3xl font-bold mt-2">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${colors.bg}`}>
                  <card.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Events by Type */}
      {Object.keys(stats.byType).length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {tr('События по типам', 'Events by Type')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {type}: <span className="font-bold ml-1">{count}</span>
                </Badge>
              ))}
          </div>
        </Card>
      )}

      {/* Recent Critical Events */}
      {stats.recentCritical && stats.recentCritical.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            {tr('Последние критичные события', 'Recent Critical Events')}
          </h3>
          <div className="space-y-2">
            {stats.recentCritical.slice(0, 5).map((event: Event, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
              >
                <Badge
                  variant={event.severity === 'ERROR' ? 'destructive' : 'secondary'}
                  className="text-xs mt-0.5"
                >
                  {event.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{event.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.ts).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm mt-1 text-muted-foreground truncate">
                    {event.message || event.action}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
