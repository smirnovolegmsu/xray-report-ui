'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apiClient, handleApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

interface ChartData {
  date: string;
  traffic_gb: number;
  connections: number;
}

interface TrafficChartProps {
  selectedDate: string | null;
  mode: 'daily' | 'cumulative';
  metric: 'traffic' | 'conns';
}

export function TrafficChart({ selectedDate, mode, metric }: TrafficChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadChartData();
  }, [selectedDate, mode, metric]);

    const loadChartData = async () => {
      try {
        setLoading(true);
        
        // Use getDashboard API (same as port 8787)
        const response = await apiClient.getDashboard({ days: 14 });
        const apiData = response.data as any;
        
        if (!apiData.ok) {
          throw new Error(apiData.error || 'Failed to load data');
        }
        
        // Get data from global object
        const globalData = apiData.global || {};
        const dates = apiData.meta?.days || [];
        
        // Choose data based on mode
        let trafficData: number[];
        let connsData: number[];
        
        if (mode === 'cumulative') {
          trafficData = globalData.cumulative_traffic_bytes || [];
          connsData = globalData.cumulative_conns || [];
        } else {
          trafficData = globalData.daily_traffic_bytes || [];
          connsData = globalData.daily_conns || [];
        }
        
        const chartData = dates.map((dateStr: string, index: number) => ({
          date: new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
          }),
          traffic_gb: Math.round((trafficData[index] / 1024 / 1024 / 1024) * 100) / 100,
          connections: connsData[index] || 0,
        }));

      setData(chartData);
    } catch (error) {
      console.error('Error loading chart data:', error);
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-2 container-chart">
        <div className="h-3 w-28 bg-muted animate-pulse rounded mb-2"></div>
        <div className="h-[140px] @[400px]:h-[180px] @[600px]:h-[200px] bg-muted animate-pulse rounded"></div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-2 container-chart">
        <h3 className="text-[10px] @[400px]:text-xs font-semibold mb-2">
          {lang === 'ru' ? 'Статистика за 7 дней' : 'Last 7 Days Stats'}
        </h3>
        <div className="h-[140px] @[400px]:h-[180px] flex items-center justify-center text-muted-foreground text-xs">
          {lang === 'ru' ? 'Нет данных для отображения' : 'No data to display'}
        </div>
      </Card>
    );
  }

  // Adaptive chart height based on container width
  const chartHeight = 'var(--chart-height, 140px)';

  return (
    <Card className="p-2 container-chart" style={{
      '--chart-height': '140px'
    } as React.CSSProperties}>
      <h3 className="text-[10px] @[400px]:text-xs font-semibold mb-2 truncate">
        {metric === 'traffic' 
          ? (lang === 'ru' ? 'Трафик за 7 дней' : 'Traffic (7 Days)')
          : (lang === 'ru' ? 'Подключения за 7 дней' : 'Connections (7 Days)')}
      </h3>
      <ResponsiveContainer width="100%" height={140} className="@[400px]:!h-[180px] @[600px]:!h-[200px]">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={metric === 'traffic' ? '#3b82f6' : '#8b5cf6'} stopOpacity={0.8} />
              <stop offset="95%" stopColor={metric === 'traffic' ? '#3b82f6' : '#8b5cf6'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-[9px] @[400px]:text-[10px]"
            stroke="currentColor"
            tick={{ fontSize: 9 }}
          />
          <YAxis
            className="text-[9px] @[400px]:text-[10px]"
            stroke="currentColor"
            tick={{ fontSize: 9 }}
            label={{
              value: metric === 'traffic' 
                ? (lang === 'ru' ? 'GB' : 'GB')
                : (lang === 'ru' ? 'Подкл.' : 'Conns'),
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 9 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '10px',
            }}
          />
          {/* Hide legend on very small screens */}
          <Legend wrapperStyle={{ fontSize: '10px' }} className="hidden @[400px]:block" />
          <Area
            type="monotone"
            dataKey={metric === 'traffic' ? 'traffic_gb' : 'connections'}
            name={metric === 'traffic' 
              ? (lang === 'ru' ? 'Трафик (GB)' : 'Traffic (GB)')
              : (lang === 'ru' ? 'Подключения' : 'Connections')}
            stroke={metric === 'traffic' ? '#3b82f6' : '#8b5cf6'}
            fillOpacity={1}
            fill="url(#colorMetric)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
