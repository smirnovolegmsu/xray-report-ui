'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
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
import { devLog } from '@/lib/utils';
import type { DashboardApiResponse } from '@/types';

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
      
      const response = await apiClient.getDashboard({ days: 14 });
      const apiData = response.data as DashboardApiResponse;
      
      if (!apiData.ok) {
        throw new Error(apiData.error || 'Failed to load data');
      }
      
      const globalData = apiData.global || {};
      const dates = apiData.meta?.days || [];
      
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
      devLog.error('Error loading chart data:', error);
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

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
      <ResponsiveContainer width="100%" height={195}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
          <defs>
            <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={metric === 'traffic' ? '#3b82f6' : '#8b5cf6'} stopOpacity={0.8} />
              <stop offset="95%" stopColor={metric === 'traffic' ? '#3b82f6' : '#8b5cf6'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            stroke="currentColor"
            tick={{ fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            stroke="currentColor"
            tick={{ fontSize: 10 }}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '11px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
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
