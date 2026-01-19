'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { LiveNow } from '@/components/features/live/live-now';
import { LiveCharts } from '@/components/features/live/live-charts';
import { LiveControls } from '@/components/features/live/live-controls';
import { Card } from '@/components/ui/card';

export default function OnlinePage() {
  const [scope, setScope] = useState<'global' | 'users'>('global');
  const [metric, setMetric] = useState<'traffic' | 'conns' | 'online'>('traffic');
  const [period, setPeriod] = useState('1h');
  const [granularity, setGranularity] = useState('1m');

  // Load from localStorage
  useEffect(() => {
    const savedScope = localStorage.getItem('live-scope');
    if (savedScope === 'global' || savedScope === 'users') {
      setScope(savedScope);
    }

    const savedMetric = localStorage.getItem('live-metric');
    if (savedMetric === 'traffic' || savedMetric === 'conns' || savedMetric === 'online') {
      setMetric(savedMetric);
    }

    const savedPeriod = localStorage.getItem('live-period');
    if (savedPeriod) {
      setPeriod(savedPeriod);
    }

    const savedGranularity = localStorage.getItem('live-granularity');
    if (savedGranularity) {
      setGranularity(savedGranularity);
    }
  }, []);

  const handleScopeChange = (newScope: 'global' | 'users') => {
    setScope(newScope);
    localStorage.setItem('live-scope', newScope);
  };

  const handleMetricChange = (newMetric: 'traffic' | 'conns' | 'online') => {
    setMetric(newMetric);
    localStorage.setItem('live-metric', newMetric);
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    localStorage.setItem('live-period', newPeriod);
  };

  const handleGranularityChange = (newGranularity: string) => {
    setGranularity(newGranularity);
    localStorage.setItem('live-granularity', newGranularity);
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time connections and traffic
          </p>
        </div>

        <LiveNow />

        {/* Controls Card */}
        <Card className="p-4">
          <LiveControls
            scope={scope}
            metric={metric}
            period={period}
            granularity={granularity}
            onScopeChange={handleScopeChange}
            onMetricChange={handleMetricChange}
            onPeriodChange={handlePeriodChange}
            onGranularityChange={handleGranularityChange}
          />
        </Card>

        <LiveCharts 
          scope={scope}
          metric={metric}
          period={period}
          granularity={granularity}
        />
      </div>
    </MainLayout>
  );
}
