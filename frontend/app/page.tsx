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

  // Load from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('overview-mode');
    if (savedMode === 'cumulative' || savedMode === 'daily') {
      setMode(savedMode);
    }
    
    const savedMetric = localStorage.getItem('overview-metric');
    if (savedMetric === 'traffic' || savedMetric === 'conns') {
      setMetric(savedMetric);
    }
  }, []);

  // Save mode to localStorage
  const handleModeChange = (newMode: 'daily' | 'cumulative') => {
    setMode(newMode);
    localStorage.setItem('overview-mode', newMode);
  };

  // Save metric to localStorage
  const handleMetricChange = (newMetric: 'traffic' | 'conns') => {
    setMetric(newMetric);
    localStorage.setItem('overview-metric', newMetric);
  };

  return (
    <MainLayout>
      <div className="space-y-2 smooth-scroll">
        {/* Header with Date, Mode and Metric controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">Overview</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              System overview and metrics
            </p>
          </div>
          
          <div className="flex flex-col xs:flex-row sm:flex-row gap-1.5 sm:gap-2">
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

        <MetricsCards selectedDate={selectedDate} mode={mode} />
        
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <TrafficChart selectedDate={selectedDate} mode={mode} metric={metric} />
          <TopDomains selectedDate={selectedDate} mode={mode} />
        </div>
        
        {/* Individual User Statistics - Compact */}
        <UserStatsCards />
      </div>
    </MainLayout>
  );
}
