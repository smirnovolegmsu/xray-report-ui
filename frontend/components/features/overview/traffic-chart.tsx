'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Card } from '@/components/ui/card';
import { ResponsiveBar } from '@nivo/bar';
import { apiClient } from '@/lib/api';
import { handleApiError } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { devLog } from '@/lib/utils';
import type { DashboardApiResponse } from '@/types';

interface ChartDataPoint {
  date: string;
  value: number;
  actualValue: number;
  [key: string]: string | number;
}

interface TrafficChartProps {
  selectedDate: string | null;
  mode: 'daily' | 'cumulative';
  metric: 'traffic' | 'conns';
}

export const TrafficChart = memo(function TrafficChart({ selectedDate, mode, metric }: TrafficChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  const loadChartData = useCallback(async () => {
    try {
      setLoading(true);

      const response = await apiClient.getDashboard({ days: 14 });

      if (!response?.data) {
        throw new Error('Empty response from server');
      }
      const apiData = response.data as DashboardApiResponse;

      if (!apiData?.ok) {
        throw new Error(apiData?.error || 'Failed to load data');
      }
      
      const globalData = apiData.global || {};
      const allDates = apiData.meta?.days || [];

      let allTrafficData: number[];
      let allConnsData: number[];

      if (mode === 'cumulative') {
        allTrafficData = globalData.cumulative_traffic_bytes || [];
        allConnsData = globalData.cumulative_conns || [];
      } else {
        allTrafficData = globalData.daily_traffic_bytes || [];
        allConnsData = globalData.daily_conns || [];
      }

      // Take only the last 7 days for display
      const dates = allDates.slice(-7);
      const trafficData = allTrafficData.slice(-7);
      const connsData = allConnsData.slice(-7);

      // Calculate raw values
      const rawValues = dates
        .filter((dateStr: string) => dateStr && !isNaN(new Date(dateStr).getTime())) // Filter invalid dates
        .map((dateStr: string, index: number) => {
          const parsedDate = new Date(dateStr);
          return {
            date: parsedDate.toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
            }),
            rawValue: metric === 'traffic'
              ? Math.round(((trafficData[index] || 0) / 1024 / 1024 / 1024) * 100) / 100
              : connsData[index] || 0,
          };
        });

      // Find max value for scaling (handle empty arrays)
      const maxValue = rawValues.length > 0
        ? Math.max(...rawValues.map(d => d.rawValue), 0.01)
        : 0.01;
      // Set minimum visible height at 5% of max (so small values are still visible)
      const minVisibleValue = maxValue * 0.05;
      
      // Apply minimum visible value while preserving actual value for labels
      const chartData = rawValues.map(d => ({
        date: d.date,
        value: Math.max(d.rawValue, minVisibleValue),
        actualValue: d.rawValue, // Preserve actual value for label
      }));

      setData(chartData);
    } catch (error) {
      devLog.error('Error loading chart data:', error);
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, mode, metric]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  // Height matches 2 metric cards: 115 + 115 + 8 (gap) = 238px
  
  if (loading) {
    return (
      <Card className="p-3 h-[238px]">
        <div className="h-4 w-32 bg-muted animate-pulse rounded mb-3"></div>
        <div className="h-[190px] bg-muted animate-pulse rounded"></div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-3 h-[238px]">
        <h3 className="text-sm font-semibold mb-2">
          {lang === 'ru' ? 'Трафик (7 дней)' : 'Traffic (7 Days)'}
        </h3>
        <div className="h-[190px] flex items-center justify-center text-muted-foreground text-sm">
          {lang === 'ru' ? 'Нет данных' : 'No data'}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 h-[238px]">
      <h3 className="text-sm font-semibold mb-2">
        {metric === 'traffic' 
          ? (lang === 'ru' ? 'Трафик (7 дней)' : 'Traffic (7 Days)')
          : (lang === 'ru' ? 'Подключения (7 дней)' : 'Connections (7 Days)')}
      </h3>
      <div style={{ height: '195px', width: '100%' }}>
        <ResponsiveBar
          data={data}
          keys={['value']}
          indexBy="date"
          margin={{ top: 50, right: 10, bottom: 30, left: 10 }}
          padding={0.3}
          valueScale={{ type: 'linear' }}
          indexScale={{ type: 'band', round: true }}
          colors={(d) => metric === 'traffic' ? '#3b82f6' : '#8b5cf6'}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: '',
            legendOffset: 36,
            legendPosition: 'middle',
          }}
          axisLeft={null}
          enableGridY={false}
          enableGridX={false}
          labelSkipWidth={12}
          labelSkipHeight={12}
          label={(d) => {
            // Use actualValue for label (real data), not display value
            const actualVal = (d.data as { actualValue?: number }).actualValue ?? Number(d.value);
            if (metric === 'traffic') {
              const gb = actualVal;
              // Show MB for values less than 0.1 GB
              if (gb < 0.1) {
                const mb = gb * 1024;
                return mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(0)} MB`;
              }
              return `${gb.toFixed(1)} GB`;
            }
            const yValue = actualVal;
            return yValue >= 1000 ? `${(yValue / 1000).toFixed(1)}k` : yValue.toString();
          }}
          labelTextColor="hsl(var(--foreground))"
          theme={{
            labels: {
              text: {
                fill: 'hsl(var(--foreground))',
                fontSize: 10,
                fontWeight: 600,
              },
            },
            tooltip: {
              container: {
                background: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
                fontSize: '11px',
                borderRadius: '8px',
                padding: '8px 12px',
                border: '1px solid hsl(var(--border))',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              },
            },
            axis: {
              ticks: {
                text: {
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 10,
                },
              },
            },
          }}
          animate={true}
          motionConfig="gentle"
          tooltip={({ id, value, indexValue }) => (
            <div
              style={{
                background: 'hsl(var(--popover))',
                padding: '8px 12px',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '11px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                {indexValue}
              </div>
              <div>
                {metric === 'traffic' 
                  ? `${Number(value).toFixed(2)} GB`
                  : Number(value).toLocaleString()}
              </div>
            </div>
          )}
        />
      </div>
    </Card>
  );
});
