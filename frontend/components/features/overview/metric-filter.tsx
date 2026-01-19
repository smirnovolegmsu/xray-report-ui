'use client';

import { Button } from '@/components/ui/button';
import { TrendingUp, Activity } from 'lucide-react';

interface MetricFilterProps {
  metric: 'traffic' | 'conns';
  onMetricChange: (metric: 'traffic' | 'conns') => void;
}

export function MetricFilter({ metric, onMetricChange }: MetricFilterProps) {
  return (
    <div className="inline-flex items-center rounded-lg border p-0.5 gap-0.5">
      <Button
        variant={metric === 'traffic' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onMetricChange('traffic')}
        className="h-9 sm:h-8 min-h-[44px] sm:min-h-0 text-xs px-2"
      >
        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden xs:inline ml-1">Traffic</span>
      </Button>
      <Button
        variant={metric === 'conns' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onMetricChange('conns')}
        className="h-9 sm:h-8 min-h-[44px] sm:min-h-0 text-xs px-2"
      >
        <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden xs:inline ml-1">Conns</span>
      </Button>
    </div>
  );
}
