'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pause, Play } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';

interface LiveChartsProps {
  scope: 'global' | 'users';
  metric: 'traffic' | 'conns' | 'online';
  period: string;
  granularity: string;
}

export function LiveCharts({ scope, metric, period, granularity }: LiveChartsProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  const loadData = useCallback(async () => {
    try {
      // Convert metric to API format
      const apiMetric = metric === 'online' ? 'online_users' : metric;
      
      // Convert period string to seconds
      const periodMap: Record<string, string> = {
        '1h': '3600',
        '6h': '21600',
        '24h': '86400',
      };
      
      // Convert granularity string to seconds
      const granularityMap: Record<string, string> = {
        '1m': '60',
        '5m': '300',
        '10m': '600',
        '15m': '900',
        '30m': '1800',
      };
      
      const response = await apiClient.getLiveSeries({
        metric: apiMetric,
        period: periodMap[period] || '3600',
        gran: granularityMap[granularity] || '300',
        scope,
      });

      if (response.data.series) {
        const formatted = response.data.series.map((point: any) => ({
          time: new Date(point.ts).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          value: metric === 'traffic' ? (point.value || 0) / 1024 / 1024 : (point.value || 0),
        }));
        setChartData(formatted);
      }

      setLoading(false);
    } catch (error) {
      if (loading) {
        toast.error(handleApiError(error));
      }
      setLoading(false);
    }
  }, [scope, metric, period, granularity, paused, loading]);

  useEffect(() => {
    loadData();
    if (!paused) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [loadData, paused]);

  const getChartTitle = () => {
    const titles: Record<string, { ru: string; en: string }> = {
      traffic: { ru: 'Трафик (MB)', en: 'Traffic (MB)' },
      conns: { ru: 'Активные подключения', en: 'Active Connections' },
      online: { ru: 'Онлайн пользователи', en: 'Online Users' },
    };
    const title = titles[metric] || titles.conns;
    return lang === 'ru' ? title.ru : title.en;
  };

  const getChartColor = () => {
    if (metric === 'traffic') return 'rgb(59, 130, 246)'; // Blue
    if (metric === 'conns') return 'rgb(34, 197, 94)'; // Green
    return 'rgb(168, 85, 247)'; // Purple
  };

  return (
    <div className="space-y-2">
      {/* Chart Header with Pause */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{getChartTitle()}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {paused ? (lang === 'ru' ? 'Пауза' : 'Paused') : (lang === 'ru' ? 'Обновление 5с' : 'Update 5s')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaused(!paused)}
            className="h-7 w-7 p-0"
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[250px] md:h-[300px] bg-muted animate-pulse rounded"></div>
      ) : chartData.length === 0 ? (
        <div className="h-[250px] md:h-[300px] flex items-center justify-center border rounded-lg">
          <p className="text-sm text-muted-foreground">
            {lang === 'ru' ? 'Нет данных' : 'No data'}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="time"
              className="text-xs"
              stroke="currentColor"
              tick={{ fontSize: 10 }}
            />
            <YAxis className="text-xs" stroke="currentColor" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number | undefined) => {
                if (value === undefined) return ['0', ''];
                if (metric === 'traffic') {
                  return [`${value.toFixed(2)} MB`, 'Traffic'];
                }
                return [value.toFixed(0), metric === 'online' ? 'Users' : 'Connections'];
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={getChartColor()}
              strokeWidth={2}
              dot={false}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
