'use client';

import { Button } from '@/components/ui/button';
import { Users, Globe, TrendingUp, Activity, Clock } from 'lucide-react';

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
    <div className="space-y-3">
      {/* Scope Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground min-w-[80px]">Scope:</span>
        <div className="inline-flex items-center rounded-lg border p-1 gap-1">
          <Button
            variant={scope === 'global' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onScopeChange('global')}
            className="gap-2"
          >
            <Globe className="w-4 h-4" />
            Global
          </Button>
          <Button
            variant={scope === 'users' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onScopeChange('users')}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Per User
          </Button>
        </div>
      </div>

      {/* Metric Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground min-w-[80px]">Metric:</span>
        <div className="inline-flex items-center rounded-lg border p-1 gap-1">
          <Button
            variant={metric === 'traffic' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onMetricChange('traffic')}
            className="gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Traffic
          </Button>
          <Button
            variant={metric === 'conns' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onMetricChange('conns')}
            className="gap-2"
          >
            <Activity className="w-4 h-4" />
            Connections
          </Button>
          <Button
            variant={metric === 'online' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onMetricChange('online')}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Online
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground min-w-[80px]">Period:</span>
        <div className="inline-flex items-center rounded-lg border p-1 gap-1">
          <Button
            variant={period === '1h' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('1h')}
          >
            1 Hour
          </Button>
          <Button
            variant={period === '6h' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('6h')}
          >
            6 Hours
          </Button>
          <Button
            variant={period === '24h' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPeriodChange('24h')}
          >
            24 Hours
          </Button>
        </div>
      </div>

      {/* Granularity Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground min-w-[80px]">Granularity:</span>
        <div className="inline-flex items-center rounded-lg border p-1 gap-1">
          <Button
            variant={granularity === '1m' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange('1m')}
            className="gap-2"
          >
            <Clock className="w-3 h-3" />
            1 Min
          </Button>
          <Button
            variant={granularity === '5m' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange('5m')}
            className="gap-2"
          >
            <Clock className="w-3 h-3" />
            5 Min
          </Button>
          <Button
            variant={granularity === '10m' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange('10m')}
            className="gap-2"
          >
            <Clock className="w-3 h-3" />
            10 Min
          </Button>
        </div>
      </div>
    </div>
  );
}
