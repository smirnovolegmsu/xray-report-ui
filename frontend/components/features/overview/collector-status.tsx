'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { Clock, DatabaseZap, AlertTriangle } from 'lucide-react';
import type { DashboardApiResponse } from '@/types';

interface CollectorStatusProps {
  dashboard: DashboardApiResponse | null;
}

export const CollectorStatus = memo(function CollectorStatus({ dashboard }: CollectorStatusProps) {
  const { lang } = useAppStore();

  const enabled = dashboard?.collector?.enabled;
  const lagDays = dashboard?.collector?.lag_days ?? null;

  const statusLabel =
    enabled === false
      ? (lang === 'ru' ? 'Выключен' : 'Disabled')
      : (lang === 'ru' ? 'Включен' : 'Enabled');

  const isLagging = typeof lagDays === 'number' && lagDays !== null && lagDays > 1;

  return (
    <Card className="p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">
          {lang === 'ru' ? 'Collector' : 'Collector'}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`h-5 px-1.5 text-[10px] font-semibold ${
              enabled === false
                ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
                : 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            {statusLabel}
          </Badge>
          {typeof lagDays === 'number' && (
            <Badge
              variant="outline"
              className={`h-5 px-1.5 text-[10px] font-semibold ${
                isLagging
                  ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                  : 'border-gray-500/50 bg-gray-500/10 text-gray-600'
              }`}
              title={lang === 'ru' ? 'Отставание сборщика (дней)' : 'Collector lag (days)'}
            >
              <Clock className="w-3 h-3 mr-1" />
              {lagDays}d
            </Badge>
          )}
        </div>
        {isLagging && (
          <div className="text-[10px] text-muted-foreground mt-1">
            {lang === 'ru'
              ? 'Статистика может быть неактуальной'
              : 'Stats may be outdated'}
          </div>
        )}
      </div>
      {isLagging ? (
        <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />
      ) : (
        <DatabaseZap className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
    </Card>
  );
});

