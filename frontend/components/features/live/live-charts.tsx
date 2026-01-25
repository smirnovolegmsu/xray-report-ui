'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pause, Play, BarChart3, TrendingUp } from 'lucide-react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
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

interface ChartDataPoint {
  time: string;
  value: number;
  [key: string]: string | number;
}

export const LiveCharts = memo(function LiveCharts({ scope, metric, period, granularity }: LiveChartsProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line'); // Default to line
  const { lang } = useAppStore();
  
  // Load chart type from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const savedType = localStorage.getItem('live-chart-type');
      if (savedType === 'line' || savedType === 'bar') {
        setChartType(savedType);
      }
    }
  }, []);
  
  const handleChartTypeChange = (type: 'line' | 'bar') => {
    setChartType(type);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('live-chart-type', type);
    }
  };

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

      if (response?.data?.series) {
        // Format data for both line and bar charts
        const formatted = response.data.series.map((point: any) => {
          const timestamp = new Date(point.ts);
          // For line chart, use full timestamp for x-axis
          // For bar chart, use formatted time string
          return {
            time: timestamp.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            timestamp: timestamp.getTime(), // For line chart sorting
            value: metric === 'traffic' ? (point.value || 0) / 1024 / 1024 : (point.value || 0),
          };
        });
        // Sort by timestamp for line chart
        formatted.sort((a: any, b: any) => a.timestamp - b.timestamp);
        setChartData(formatted);
      }

      setLoading(false);
    } catch (error) {
      if (loading) {
        toast.error(handleApiError(error));
      }
      setLoading(false);
    }
  }, [scope, metric, period, granularity, loading, lang]);

  useEffect(() => {
    loadData();
    if (!paused) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [loadData, paused]);

  const getChartTitle = useCallback(() => {
    const titles: Record<string, { ru: string; en: string }> = {
      traffic: { ru: 'Трафик (MB)', en: 'Traffic (MB)' },
      conns: { ru: 'Активные подключения', en: 'Active Connections' },
      online: { ru: 'Онлайн пользователи', en: 'Online Users' },
    };
    const title = titles[metric] || titles.conns;
    return lang === 'ru' ? title.ru : title.en;
  }, [metric, lang]);

  const getChartColor = useCallback(() => {
    if (metric === 'traffic') return 'rgb(59, 130, 246)'; // Blue
    if (metric === 'conns') return 'rgb(34, 197, 94)'; // Green
    return 'rgb(168, 85, 247)'; // Purple
  }, [metric]);

  const chartTitle = useMemo(() => getChartTitle(), [getChartTitle]);
  const chartColor = useMemo(() => getChartColor(), [getChartColor]);

  return (
    <div className="space-y-2">
      {/* Chart Header with Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{chartTitle}</h3>
        <div className="flex items-center gap-2">
          {/* Chart Type Toggle */}
          <div className="inline-flex items-center rounded-md border p-0.5">
            <Button
              variant={chartType === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleChartTypeChange('line')}
              className="h-7 w-7 p-0"
              title={lang === 'ru' ? 'Линия' : 'Line'}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleChartTypeChange('bar')}
              className="h-7 w-7 p-0"
              title={lang === 'ru' ? 'Гистограмма' : 'Bar'}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </Button>
          </div>
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
        <div style={{ height: '250px', width: '100%' }}>
          {chartType === 'line' ? (
            <ResponsiveLine
              data={[
                {
                  id: metric,
                  data: chartData.map((point) => ({
                    x: point.time,
                    y: point.value,
                  })),
                },
              ]}
              margin={{ top: 50, right: 10, bottom: 50, left: 50 }}
              xScale={{ type: 'point' }}
              yScale={{
                type: 'linear',
                min: 'auto',
                max: 'auto',
              }}
              curve="monotoneX"
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: -45,
                legend: '',
                legendOffset: 36,
                legendPosition: 'middle',
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: '',
                legendOffset: -40,
                legendPosition: 'middle',
              }}
              pointSize={6}
              pointColor={getChartColor()}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              pointLabelYOffset={-12}
              useMesh={true}
              colors={[getChartColor()]}
              lineWidth={2}
              theme={{
                grid: {
                  line: {
                    stroke: 'hsl(var(--border))',
                    strokeWidth: 1,
                    strokeDasharray: '2 2',
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
                tooltip: {
                  container: {
                    background: 'hsl(var(--popover))',
                    color: 'hsl(var(--popover-foreground))',
                    fontSize: '12px',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    border: '1px solid hsl(var(--border))',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  },
                },
              }}
              animate={!paused}
              motionConfig="gentle"
              tooltip={({ point }) => (
                <div
                  style={{
                    background: 'hsl(var(--popover))',
                    padding: '8px 12px',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {point.data.x}
                  </div>
                  <div>
                    {metric === 'traffic' 
                      ? `${Number(point.data.y).toFixed(2)} MB`
                      : metric === 'online'
                      ? `${Number(point.data.y).toFixed(0)} ${lang === 'ru' ? 'пользователей' : 'users'}`
                      : Number(point.data.y).toLocaleString()}
                  </div>
                </div>
              )}
            />
          ) : (
            <ResponsiveBar
              data={chartData}
              keys={['value']}
              indexBy="time"
              margin={{ top: 50, right: 10, bottom: 30, left: 10 }}
              padding={0.3}
              valueScale={{ type: 'linear' }}
              indexScale={{ type: 'band', round: true }}
              colors={getChartColor()}
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
                if (metric === 'traffic') {
                  return `${Number(d.value).toFixed(1)} MB`;
                }
                if (metric === 'online') {
                  return `${Number(d.value).toFixed(0)}`;
                }
                const yValue = Number(d.value);
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
                    fontSize: '12px',
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
              animate={!paused}
              motionConfig="gentle"
              tooltip={({ id, value, indexValue }) => (
                <div
                  style={{
                    background: 'hsl(var(--popover))',
                    padding: '8px 12px',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {indexValue}
                  </div>
                  <div>
                    {metric === 'traffic' 
                      ? `${Number(value).toFixed(2)} MB`
                      : metric === 'online'
                      ? `${Number(value).toFixed(0)} ${lang === 'ru' ? 'пользователей' : 'users'}`
                      : Number(value).toLocaleString()}
                  </div>
                </div>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
});
