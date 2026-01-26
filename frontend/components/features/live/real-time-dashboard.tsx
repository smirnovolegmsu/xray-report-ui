'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Activity,
  HardDrive,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Pause,
  Play,
} from 'lucide-react';
import { ResponsiveLine } from '@nivo/line';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError, devLog, formatBytes } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { liveNumberFlowConfig } from '@/lib/number-flow-config';
import type { User } from '@/types';
import { getCardColorClasses } from '@/lib/card-colors';
import { useTr } from '@/lib/i18n';

interface ChartDataPoint {
  x: string;
  y: number;
}

export function RealTimeDashboard() {
  const [liveData, setLiveData] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [chartData, setChartData] = useState<{
    traffic: ChartDataPoint[];
    connections: ChartDataPoint[];
    online: ChartDataPoint[];
  }>({
    traffic: [],
    connections: [],
    online: [],
  });
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'traffic' | 'connections' | 'online'>('connections');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');
  const { lang } = useAppStore();
  const tr = useTr();

  // Load users for display names
  const loadUsers = useCallback(async () => {
    try {
      const response = await apiClient.getUsers();
      setUsers(response?.data?.users || []);
    } catch (error) {
      devLog.error('Failed to load users:', error);
    }
  }, []);

  // Get user display name
  const getUserDisplayName = useCallback(
    (uuid: string): string => {
      const user = users.find((u) => u.uuid === uuid || u.email === uuid);
      if (!user) return uuid;
      return user.alias || user.email || uuid;
    },
    [users]
  );

  // Load current "now" state
  const loadLiveNow = useCallback(async () => {
    try {
      const response = await apiClient.getLiveNow();
      setLiveData(response.data);
      setLoading(false);
    } catch (error) {
      if (loading) {
        toast.error(handleApiError(error));
      }
      setLoading(false);
    }
  }, [loading]);

  // Load chart data for all metrics
  const loadChartData = useCallback(async () => {
    try {
      const periodMap = { '1h': '3600', '6h': '21600', '24h': '86400' };
      const period = periodMap[timeRange];
      const gran = timeRange === '1h' ? '60' : timeRange === '6h' ? '300' : '600';

      // Load all three metrics in parallel
      const [trafficRes, connsRes, onlineRes] = await Promise.all([
        apiClient.getLiveSeries({ metric: 'traffic', period, gran, scope: 'global' }),
        apiClient.getLiveSeries({ metric: 'conns', period, gran, scope: 'global' }),
        apiClient.getLiveSeries({ metric: 'online_users', period, gran, scope: 'global' }),
      ]);

      const formatSeries = (series: any[], divider: number = 1) => {
        return (series || []).map((point: any) => {
          const timestamp = new Date(point.ts);
          return {
            x: timestamp.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            y: (point.value || 0) / divider,
          };
        });
      };

      setChartData({
        traffic: formatSeries(trafficRes?.data?.series || [], 1024 * 1024), // Convert to MB
        connections: formatSeries(connsRes?.data?.series || []),
        online: formatSeries(onlineRes?.data?.series || []),
      });
    } catch (error) {
      devLog.error('Failed to load chart data:', error);
    }
  }, [timeRange, lang]);

  // Initial load
  useEffect(() => {
    loadUsers();
    loadLiveNow();
    loadChartData();
  }, [loadUsers, loadLiveNow, loadChartData]);

  // Auto-refresh when not paused
  useEffect(() => {
    if (!paused) {
      const interval = setInterval(() => {
        loadLiveNow();
        loadChartData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [paused, loadLiveNow, loadChartData]);

  const now = liveData?.now || {};
  const onlineUsers = now.onlineUsers || [];
  const totalConns = now.conns || 0;
  const totalTraffic = now.trafficBytes || 0;

  // Calculate stats for selected metric
  const currentChartData = useMemo(() => {
    if (selectedMetric === 'traffic') return chartData.traffic;
    if (selectedMetric === 'online') return chartData.online;
    return chartData.connections;
  }, [selectedMetric, chartData]);

  const stats = useMemo(() => {
    if (currentChartData.length === 0) {
      return { current: 0, max: 0, min: 0, avg: 0 };
    }
    const values = currentChartData.map((p) => p.y);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const current = values[values.length - 1] || 0;
    return { current, max, min, avg };
  }, [currentChartData]);

  const getChartColor = () => {
    if (selectedMetric === 'traffic') return '#3b82f6'; // Blue
    if (selectedMetric === 'online') return '#a855f7'; // Purple
    return '#22c55e'; // Green
  };

  const getMetricLabel = () => {
    if (selectedMetric === 'traffic') return lang === 'ru' ? 'Трафик (MB)' : 'Traffic (MB)';
    if (selectedMetric === 'online') return lang === 'ru' ? 'Онлайн' : 'Online Users';
    return lang === 'ru' ? 'Подключения' : 'Connections';
  };

  const formatValue = (value: number) => {
    if (selectedMetric === 'traffic') return `${value.toFixed(2)} MB`;
    return Math.round(value).toString();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Card className="p-3 md:p-4">
          <div className="h-32 bg-muted animate-pulse rounded"></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current Status Cards */}
      <Card className="p-3 md:p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {/* Online Users */}
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 ${getCardColorClasses('blue').bg} rounded-lg flex items-center justify-center shrink-0`}
            >
              <Users className={`w-4 h-4 ${getCardColorClasses('blue').text}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{tr('Онлайн', 'Online Users')}</p>
              <p className="text-xl font-bold">
                <NumberFlow value={onlineUsers.length} {...liveNumberFlowConfig} willChange />
              </p>
            </div>
          </div>

          {/* Active Connections */}
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 ${getCardColorClasses('green').bg} rounded-lg flex items-center justify-center shrink-0`}
            >
              <Activity className={`w-4 h-4 ${getCardColorClasses('green').text}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{tr('Подключения', 'Connections')}</p>
              <p className="text-xl font-bold">
                <NumberFlow value={totalConns} {...liveNumberFlowConfig} willChange />
              </p>
            </div>
          </div>

          {/* Current Traffic */}
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 ${getCardColorClasses('purple').bg} rounded-lg flex items-center justify-center shrink-0`}
            >
              <HardDrive className={`w-4 h-4 ${getCardColorClasses('purple').text}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{tr('Трафик', 'Traffic')}</p>
              <p className="text-xl font-bold truncate">{formatBytes(totalTraffic) as string}</p>
            </div>
          </div>
        </div>

        {/* Online Users List */}
        {onlineUsers.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex flex-wrap gap-1.5">
              {onlineUsers.map((user: string, idx: number) => (
                <Badge key={idx} variant="outline" className="gap-1 text-xs h-6 px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  {getUserDisplayName(user)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Chart */}
      <Card className="p-3 md:p-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{getMetricLabel()}</h3>
            <Badge variant="outline" className="text-xs">
              {paused ? (lang === 'ru' ? 'Пауза' : 'Paused') : (lang === 'ru' ? '5с' : '5s')}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Metric Selector */}
            <div className="inline-flex items-center rounded-md border p-0.5">
              <Button
                variant={selectedMetric === 'connections' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedMetric('connections')}
                className="h-7 text-xs px-2"
              >
                {lang === 'ru' ? 'Подключ.' : 'Conns'}
              </Button>
              <Button
                variant={selectedMetric === 'traffic' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedMetric('traffic')}
                className="h-7 text-xs px-2"
              >
                {lang === 'ru' ? 'Трафик' : 'Traffic'}
              </Button>
              <Button
                variant={selectedMetric === 'online' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedMetric('online')}
                className="h-7 text-xs px-2"
              >
                {lang === 'ru' ? 'Онлайн' : 'Online'}
              </Button>
            </div>

            {/* Time Range */}
            <div className="inline-flex items-center rounded-md border p-0.5">
              <Button
                variant={timeRange === '1h' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange('1h')}
                className="h-7 text-xs px-2"
              >
                1h
              </Button>
              <Button
                variant={timeRange === '6h' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange('6h')}
                className="h-7 text-xs px-2"
              >
                6h
              </Button>
              <Button
                variant={timeRange === '24h' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange('24h')}
                className="h-7 text-xs px-2"
              >
                24h
              </Button>
            </div>

            {/* Pause/Play */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaused(!paused)}
              className="h-7 w-7 p-0"
              title={paused ? (lang === 'ru' ? 'Возобновить' : 'Resume') : (lang === 'ru' ? 'Пауза' : 'Pause')}
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </Button>

            {/* Manual Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                loadLiveNow();
                loadChartData();
              }}
              className="h-7 w-7 p-0"
              title={lang === 'ru' ? 'Обновить' : 'Refresh'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              {lang === 'ru' ? 'Текущ.' : 'Current'}
            </p>
            <p className="text-sm font-bold">{formatValue(stats.current)}</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              {lang === 'ru' ? 'Макс.' : 'Max'}
            </p>
            <p className="text-sm font-bold">{formatValue(stats.max)}</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              {lang === 'ru' ? 'Мин.' : 'Min'}
            </p>
            <p className="text-sm font-bold">{formatValue(stats.min)}</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              {lang === 'ru' ? 'Средн.' : 'Avg'}
            </p>
            <p className="text-sm font-bold">{formatValue(stats.avg)}</p>
          </div>
        </div>

        {/* Chart */}
        {currentChartData.length === 0 ? (
          <div className="h-[200px] md:h-[300px] flex flex-col items-center justify-center border rounded-lg bg-muted/20">
            <Activity className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {lang === 'ru' ? 'Нет данных за выбранный период' : 'No data for selected period'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === 'ru' ? 'Данные появятся при активности' : 'Data will appear when there is activity'}
            </p>
          </div>
        ) : (
          <div style={{ height: '200px', width: '100%' }} className="md:h-[300px]">
            <ResponsiveLine
              data={[
                {
                  id: selectedMetric,
                  data: currentChartData,
                },
              ]}
              margin={{ top: 20, right: 10, bottom: 40, left: 50 }}
              xScale={{ type: 'point' }}
              yScale={{
                type: 'linear',
                min: 0,
                max: 'auto',
              }}
              curve="monotoneX"
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: -45,
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
              }}
              pointSize={6}
              pointColor={getChartColor()}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              useMesh={true}
              colors={[getChartColor()]}
              lineWidth={2}
              enableArea={true}
              areaOpacity={0.1}
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
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{point.data.x}</div>
                  <div>{formatValue(point.data.y as number)}</div>
                </div>
              )}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
