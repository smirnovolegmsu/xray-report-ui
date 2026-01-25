'use client';

import { memo, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Users, Database } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import type { DashboardApiResponse } from '@/types';

interface KpiCardsProps {
  dashboard: DashboardApiResponse | null;
}

export const KpiCards = memo(function KpiCards({ dashboard }: KpiCardsProps) {
  const { lang } = useAppStore();

  const kpi = dashboard?.kpi;

  const todayBytes = kpi?.today_bytes ?? 0;
  const yesterdayBytes = kpi?.yesterday_bytes ?? 0;
  const changePct = kpi?.change_pct ?? null;

  const todayFormatted = useMemo(
    () => formatBytes(todayBytes, { returnObject: true }) as { value: string; unit: string },
    [todayBytes]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <Card className="p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground">
            {lang === 'ru' ? 'Сегодня' : 'Today'}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold leading-none">{todayFormatted.value}</span>
            <span className="text-xs text-muted-foreground">{todayFormatted.unit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {lang === 'ru' ? 'Вчера' : 'Yesterday'}:{' '}
            {formatBytes(yesterdayBytes, { compact: true }) as string}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {changePct !== null && (
            <Badge
              variant="outline"
              className={`h-5 px-1.5 text-[10px] font-semibold flex items-center gap-1 ${
                changePct > 0
                  ? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400'
                  : changePct < 0
                  ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'border-gray-500/50 bg-gray-500/10 text-gray-600'
              }`}
            >
              {changePct > 0 ? <TrendingUp className="w-3 h-3" /> : changePct < 0 ? <TrendingDown className="w-3 h-3" /> : null}
              {Math.abs(changePct).toFixed(1)}%
            </Badge>
          )}
          <Database className="w-4 h-4 text-muted-foreground" />
        </div>
      </Card>

      <Card className="p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground">
            {lang === 'ru' ? 'Всего пользователей' : 'Total users'}
          </div>
          <div className="text-xl font-bold leading-none">
            <NumberFlow value={kpi?.total_users ?? 0} format={{ style: 'decimal' }} {...defaultNumberFlowConfig} />
          </div>
        </div>
        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
      </Card>

      <Card className="p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground">
            {lang === 'ru' ? 'Активные (7д)' : 'Active (7d)'}
          </div>
          <div className="text-xl font-bold leading-none">
            <NumberFlow value={kpi?.active_users ?? 0} format={{ style: 'decimal' }} {...defaultNumberFlowConfig} />
          </div>
        </div>
        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
      </Card>
    </div>
  );
});

