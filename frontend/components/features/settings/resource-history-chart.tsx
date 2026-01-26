'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { Clock, Cpu, MemoryStick, RefreshCw } from 'lucide-react';

interface MetricData {
  timestamp: number;
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
}

interface HistoryResponse {
  data: MetricData[];
  period: string;
  granularity: string;
  count: number;
}

const PERIODS = [
  { value: '1h', label: '1 Hour', labelRu: '1 час' },
  { value: '6h', label: '6 Hours', labelRu: '6 часов' },
  { value: '24h', label: '24 Hours', labelRu: '24 часа' },
  { value: '7d', label: '7 Days', labelRu: '7 дней' },
];

const GRANULARITIES = [
  { value: '1m', label: '1 min', labelRu: '1 мин', periods: ['1h'] },
  { value: '5m', label: '5 min', labelRu: '5 мин', periods: ['1h', '6h'] },
  { value: '15m', label: '15 min', labelRu: '15 мин', periods: ['6h', '24h'] },
  { value: '30m', label: '30 min', labelRu: '30 мин', periods: ['24h', '7d'] },
  { value: '60m', label: '1 hour', labelRu: '1 час', periods: ['24h', '7d'] },
];

export function ResourceHistoryChart() {
  const [data, setData] = useState<MetricData[]>([]);
  const [period, setPeriod] = useState('1h');
  const [granularity, setGranularity] = useState('1m');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { lang } = useAppStore();

  useEffect(() => {
    loadHistory();

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      loadHistory(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [period, granularity]);

  // Auto-adjust granularity when period changes
  useEffect(() => {
    const availableGrans = GRANULARITIES.filter(g => g.periods.includes(period));
    if (availableGrans.length > 0 && !availableGrans.some(g => g.value === granularity)) {
      // Set default granularity for this period
      if (period === '1h') setGranularity('1m');
      else if (period === '6h') setGranularity('5m');
      else if (period === '24h') setGranularity('15m');
      else if (period === '7d') setGranularity('30m');
    }
  }, [period]);

  const loadHistory = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await apiClient.getResourceHistory(period, granularity);
      const historyData = response.data as HistoryResponse;

      if (historyData && historyData.data) {
        setData(historyData.data);
      }
    } catch (error) {
      if (!silent) {
        toast.error(lang === 'ru' ? 'Ошибка загрузки истории ресурсов' : 'Failed to load resource history');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts * 1000);

    if (period === '1h' || period === '6h') {
      return date.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const chartData = data.map(d => ({
    time: formatTimestamp(d.timestamp),
    cpu: d.cpu_percent,
    ram: d.ram_percent,
  }));

  const availableGranularities = GRANULARITIES.filter(g => g.periods.includes(period));

  const avgCpu = data.length > 0 ? (data.reduce((sum, d) => sum + d.cpu_percent, 0) / data.length).toFixed(1) : '0';
  const maxCpu = data.length > 0 ? Math.max(...data.map(d => d.cpu_percent)).toFixed(1) : '0';
  const avgRam = data.length > 0 ? (data.reduce((sum, d) => sum + d.ram_percent, 0) / data.length).toFixed(1) : '0';
  const maxRam = data.length > 0 ? Math.max(...data.map(d => d.ram_percent)).toFixed(1) : '0';

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {lang === 'ru' ? 'История использования ресурсов' : 'Resource Usage History'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === 'ru' ? 'CPU и RAM за выбранный период' : 'CPU and RAM over selected period'}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadHistory()}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {lang === 'ru' ? 'Обновить' : 'Refresh'}
          </Button>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground mr-2 flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {lang === 'ru' ? 'Период:' : 'Period:'}
          </span>
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.value)}
            >
              {lang === 'ru' ? p.labelRu : p.label}
            </Button>
          ))}
        </div>

        {/* Granularity Selector */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground mr-2">
            {lang === 'ru' ? 'Детализация:' : 'Granularity:'}
          </span>
          {availableGranularities.map((g) => (
            <Button
              key={g.value}
              variant={granularity === g.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGranularity(g.value)}
            >
              {lang === 'ru' ? g.labelRu : g.label}
            </Button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Cpu className="w-4 h-4" />
              <span>{lang === 'ru' ? 'CPU средн.' : 'CPU Avg'}</span>
            </div>
            <span className="text-2xl font-bold">{avgCpu}%</span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Cpu className="w-4 h-4" />
              <span>{lang === 'ru' ? 'CPU макс.' : 'CPU Max'}</span>
            </div>
            <span className="text-2xl font-bold">{maxCpu}%</span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MemoryStick className="w-4 h-4" />
              <span>{lang === 'ru' ? 'RAM средн.' : 'RAM Avg'}</span>
            </div>
            <span className="text-2xl font-bold">{avgRam}%</span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MemoryStick className="w-4 h-4" />
              <span>{lang === 'ru' ? 'RAM макс.' : 'RAM Max'}</span>
            </div>
            <span className="text-2xl font-bold">{maxRam}%</span>
          </div>
        </div>

        {/* Chart */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {lang === 'ru' ? 'Нет данных за выбранный период' : 'No data for selected period'}
          </div>
        ) : (
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  label={{ value: '%', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#3b82f6"
                  name={lang === 'ru' ? 'CPU %' : 'CPU %'}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ram"
                  stroke="#10b981"
                  name={lang === 'ru' ? 'RAM %' : 'RAM %'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Data points info */}
        {!loading && data.length > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            {data.length} {lang === 'ru' ? 'точек данных' : 'data points'}
          </div>
        )}
      </div>
    </Card>
  );
}
