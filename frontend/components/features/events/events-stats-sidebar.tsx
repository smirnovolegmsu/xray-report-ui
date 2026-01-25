'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { handleApiError } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type { EventsStats as EventsStatsType } from '@/types';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingUp,
} from 'lucide-react';
import { getCardColorClasses } from '@/lib/card-colors';
import { useTr } from '@/lib/i18n';

interface EventsStatsSidebarProps {
  hours?: number;
}

export function EventsStatsSidebar({ hours = 24 }: EventsStatsSidebarProps) {
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
      console.error('Failed to load stats:', error);
    }
  };

  if (loading || !stats) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-muted rounded w-16"></div>
              <div className="h-6 bg-muted rounded w-12"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: lang === 'ru' ? 'Всего' : 'Total',
      value: stats.total,
      icon: Activity,
      colorScheme: 'blue' as const,
    },
    {
      title: lang === 'ru' ? 'Ошибки' : 'Errors',
      value: stats.errors,
      icon: AlertCircle,
      colorScheme: 'red' as const,
    },
    {
      title: lang === 'ru' ? 'Предупр.' : 'Warnings',
      value: stats.warnings,
      icon: AlertTriangle,
      colorScheme: 'yellow' as const,
    },
    {
      title: lang === 'ru' ? 'Инфо' : 'Info',
      value: stats.info,
      icon: Info,
      colorScheme: 'green' as const,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Compact Stats Cards */}
      <div className="space-y-2">
        {statCards.map((card, idx) => {
          const colors = getCardColorClasses(card.colorScheme);
          return (
            <Card key={idx} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${colors.bg}`}>
                    <card.icon className={`w-4 h-4 ${colors.text}`} />
                  </div>
                  <span className="text-xs text-muted-foreground">{card.title}</span>
                </div>
                <span className="text-lg font-bold">{card.value}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Events by Type - Compact */}
      {Object.keys(stats.byType).length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            {tr('По типам', 'By Type')}
          </h4>
          <div className="space-y-1.5">
            {Object.entries(stats.byType)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8) // Limit to top 8
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{type}</span>
                  <Badge variant="outline" className="text-xs ml-2">
                    {count}
                  </Badge>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
