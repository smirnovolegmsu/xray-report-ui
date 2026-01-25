'use client';

import { Button } from '@/components/ui/button';

interface LiveControlsProps {
  scope: 'global' | 'users';
  metric: 'traffic' | 'conns' | 'online';
  period: string;
  granularity: string;
  onScopeChange: (scope: 'global' | 'users') => void;
  onMetricChange: (metric: 'traffic' | 'conns' | 'online') => void;
  onPeriodChange: (period: string) => void;
  onGranularityChange: (granularity: string) => void;
}

export function LiveControls({
  scope,
  metric,
  period,
  granularity,
  onScopeChange,
  onMetricChange,
  onPeriodChange,
  onGranularityChange,
}: LiveControlsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Metric Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Metric</label>
        <div className="inline-flex items-center rounded-md border p-0.5 w-full">
          <Button
            variant={metric === 'traffic' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onMetricChange('traffic')}
            className="flex-1 h-7 text-xs px-2"
          >
            Traffic
          </Button>
          <Button
            variant={metric === 'conns' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onMetricChange('conns')}
            className="flex-1 h-7 text-xs px-2"
          >
            Conns
          </Button>
          <Button
            variant={metric === 'online' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onMetricChange('online')}
            className="flex-1 h-7 text-xs px-2"
          >
            Online
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Period</label>
        <div className="inline-flex items-center rounded-md border p-0.5 w-full">
          <Button
            variant={period === '1h' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('1h')}
            className="flex-1 h-7 text-xs px-2"
          >
            1h
          </Button>
          <Button
            variant={period === '6h' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('6h')}
            className="flex-1 h-7 text-xs px-2"
          >
            6h
          </Button>
          <Button
            variant={period === '24h' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('24h')}
            className="flex-1 h-7 text-xs px-2"
          >
            24h
          </Button>
        </div>
      </div>

      {/* Granularity Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Granularity</label>
        <div className="inline-flex items-center rounded-md border p-0.5 w-full">
          <Button
            variant={granularity === '1m' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange('1m')}
            className="flex-1 h-7 text-xs px-1"
          >
            1m
          </Button>
          <Button
            variant={granularity === '5m' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange('5m')}
            className="flex-1 h-7 text-xs px-1"
          >
            5m
          </Button>
          <Button
            variant={granularity === '10m' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange('10m')}
            className="flex-1 h-7 text-xs px-1"
          >
            10m
          </Button>
          <Button
            variant={granularity === '15m' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange('15m')}
            className="flex-1 h-7 text-xs px-1"
          >
            15m
          </Button>
          <Button
            variant={granularity === '30m' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange('30m')}
            className="flex-1 h-7 text-xs px-1"
          >
            30m
          </Button>
        </div>
      </div>

      {/* Scope Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Scope</label>
        <div className="inline-flex items-center rounded-md border p-0.5 w-full">
          <Button
            variant={scope === 'global' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onScopeChange('global')}
            className="flex-1 h-7 text-xs px-2"
          >
            Global
          </Button>
          <Button
            variant={scope === 'users' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onScopeChange('users')}
            className="flex-1 h-7 text-xs px-2"
          >
            Per User
          </Button>
        </div>
      </div>
    </div>
  );
}
