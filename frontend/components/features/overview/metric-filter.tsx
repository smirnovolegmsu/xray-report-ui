'use client';

import { Button } from '@/components/ui/button';
import { TrendingUp, Activity } from 'lucide-react';

interface MetricFilterProps {
  metric: 'traffic' | 'conns';
  onMetricChange: (metric: 'traffic' | 'conns') => void;
}

export function MetricFilter({ metric, onMetricChange }: MetricFilterProps) {
  return (
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
    </div>
  );
}
