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
        
        // Always use getUsageDashboard to support mode parameter
        let response;
        if (selectedDate) {
          response = await apiClient.getUsageDashboard({
            date: selectedDate,
            mode,
            window_days: 7
          });
        } else {
          // Current data - use today's date
          const today = new Date().toISOString().split('T')[0];
          response = await apiClient.getUsageDashboard({
            date: today,
            mode,
            window_days: 7
          });
        }
        
      const apiData = response.data as any;
      
      // Transform data from Flask API format
      const dates = apiData.meta?.days || [];
      const dailyTraffic = apiData.global?.daily_traffic_bytes || [];
      const dailyConns = apiData.global?.daily_conns || [];
      
      const chartData = dates.map((dateStr: string, index: number) => ({
        date: new Date(dateStr).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
        }),
        traffic_gb: Math.round((dailyTraffic[index] / 1024 / 1024 / 1024) * 100) / 100,
        connections: dailyConns[index] || 0,
      }));

      setData(chartData);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-2">
        <div className="h-3 w-28 bg-muted animate-pulse rounded mb-2"></div>
        <div className="h-[160px] bg-muted animate-pulse rounded"></div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-2">
        <h3 className="text-xs font-semibold mb-2">
          {lang === 'ru' ? 'Статистика за 7 дней' : 'Last 7 Days Stats'}
        </h3>
        <div className="h-[160px] flex items-center justify-center text-muted-foreground text-xs">
          {lang === 'ru' ? 'Нет данных для отображения' : 'No data to display'}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-2">
      <h3 className="text-xs font-semibold mb-2">
        {metric === 'traffic' 
          ? (lang === 'ru' ? 'Трафик за 7 дней' : 'Traffic (7 Days)')
          : (lang === 'ru' ? 'Подключения за 7 дней' : 'Connections (7 Days)')}
      </h3>
      <ResponsiveContainer width="100%" height={160}>
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
            className="text-xs"
            stroke="currentColor"
          />
          <YAxis
            className="text-xs"
            stroke="currentColor"
            label={{
              value: metric === 'traffic' 
                ? (lang === 'ru' ? 'Трафик (GB)' : 'Traffic (GB)')
                : (lang === 'ru' ? 'Подключения' : 'Connections'),
              angle: -90,
              position: 'insideLeft',
              className: 'text-xs',
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend />
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
