'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { MetricsCards } from '@/components/features/overview/metrics-cards';
import { TrafficChart } from '@/components/features/overview/traffic-chart';
import { TopDomains } from '@/components/features/overview/top-domains';
import { UserStatsCards } from '@/components/features/overview/user-stats-cards';
import { DateSelector } from '@/components/features/overview/date-selector';
import { ModeToggle } from '@/components/features/overview/mode-toggle';
import { MetricFilter } from '@/components/features/overview/metric-filter';

export default function OverviewPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mode, setMode] = useState<'daily' | 'cumulative'>('daily');
  const [metric, setMetric] = useState<'traffic' | 'conns'>('traffic');

  useEffect(() => {
    // Проверяем, что localStorage доступен (только на клиенте)
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    
    const savedMode = localStorage.getItem('overview-mode');
    if (savedMode === 'cumulative' || savedMode === 'daily') {
      setMode(savedMode);
    }
    
    const savedMetric = localStorage.getItem('overview-metric');
    if (savedMetric === 'traffic' || savedMetric === 'conns') {
      setMetric(savedMetric);
    }
  }, []);

  const handleModeChange = (newMode: 'daily' | 'cumulative') => {
    setMode(newMode);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('overview-mode', newMode);
    }
  };

  const handleMetricChange = (newMetric: 'traffic' | 'conns') => {
    setMetric(newMetric);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('overview-metric', newMetric);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-3 smooth-scroll">
        {/* Header */}
        <div className="flex flex-col gap-2">
          {/* Title - hidden on mobile, shown in header instead */}
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold tracking-tight">Overview</h1>
            <p className="text-xs text-muted-foreground">
              System overview and metrics
            </p>
          </div>

          {/* Controls - wrap on mobile */}
          <div className="flex flex-wrap items-center gap-2">
            <DateSelector
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
            <ModeToggle
              mode={mode}
              onModeChange={handleModeChange}
            />
            <MetricFilter
              metric={metric}
              onMetricChange={handleMetricChange}
            />
          </div>
        </div>

        {/* Main Row: Metrics 2x2 | Chart + Top Domains */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-3 items-start">
          {/* Left: 4 Metric Cards in 2x2 - full width on mobile */}
          <div className="w-full lg:w-auto">
            <MetricsCards selectedDate={selectedDate} mode={mode} />
          </div>

          {/* Center: Traffic Chart - full width on mobile */}
          <div className="w-full min-w-0">
            <TrafficChart selectedDate={selectedDate} mode={mode} metric={metric} />
          </div>

          {/* Right: Top Domains */}
          <div className="w-full lg:w-auto">
            <TopDomains selectedDate={selectedDate} mode={mode} />
          </div>
        </div>
        
        {/* User Statistics */}
        <UserStatsCards />
      </div>
    </MainLayout>
  );
}
