'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    loadData();
    if (!paused) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [scope, metric, period, granularity, paused]);

  const loadData = async () => {
    try {
      // Convert metric to API format
      const apiMetric = metric === 'online' ? 'conns' : metric;
      
      const response = await apiClient.getLiveSeries({
        metric: apiMetric,
        period,
        gran: granularity,
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
  };

  const getChartTitle = () => {
    if (metric === 'traffic') {
      return lang === 'ru' ? 'Трафик (MB)' : 'Traffic (MB)';
    } else if (metric === 'conns') {
      return lang === 'ru' ? 'Подключения' : 'Connections';
    } else {
      return lang === 'ru' ? 'Онлайн пользователи' : 'Online Users';
    }
  };

  const getChartColor = () => {
    if (metric === 'traffic') return 'rgb(59, 130, 246)'; // Blue
    if (metric === 'conns') return 'rgb(34, 197, 94)'; // Green
    return 'rgb(168, 85, 247)'; // Purple
  };

  return (
    <div className="space-y-4">
      {/* Pause Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPaused(!paused)}
          className="gap-2"
        >
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {paused
            ? (lang === 'ru' ? 'Возобновить' : 'Resume')
            : (lang === 'ru' ? 'Пауза' : 'Pause')}
        </Button>

        <span className="text-sm text-muted-foreground">
          {paused
            ? (lang === 'ru' ? 'На паузе' : 'Paused')
            : (lang === 'ru' ? 'Обновление каждые 5 сек' : 'Updating every 5s')}
        </span>
      </div>

      {/* Chart */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">{getChartTitle()}</h3>
        {loading ? (
          <div className="h-[300px] bg-muted animate-pulse rounded"></div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="time"
                className="text-xs"
                stroke="currentColor"
              />
              <YAxis className="text-xs" stroke="currentColor" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={getChartColor()}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
