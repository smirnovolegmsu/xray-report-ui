'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, Wifi, WifiOff, RefreshCw, ExternalLink, AlertCircle, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { devLog } from '@/lib/utils';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { getCardColorClasses } from '@/lib/card-colors';
import type { PortInfo, PortsStatusResponse } from '@/types';

const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

export function PortsSettings() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [current, setCurrent] = useState<PortsStatusResponse['current'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { lang } = useAppStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPorts();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadPorts(true);
      }, AUTO_REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const loadPorts = async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true);
      }
      const response = await apiClient.getPortsStatus();
      const data = response.data as PortsStatusResponse;
      if (data && data.ports) {
        setPorts(data.ports || []);
        setCurrent(data.current);
        setLastUpdate(new Date());
      } else if (!silent) {
        toast.error(lang === 'ru' ? 'Не удалось загрузить статус портов' : 'Failed to load ports status');
      }
    } catch (error) {
      if (!silent) {
        toast.error(lang === 'ru' ? 'Ошибка загрузки статуса портов' : 'Error loading ports status');
        devLog.error('Failed to load ports:', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
    
    if (diff < 5) return lang === 'ru' ? 'только что' : 'just now';
    if (diff < 60) return `${diff} ${lang === 'ru' ? 'сек. назад' : 'sec ago'}`;
    const mins = Math.floor(diff / 60);
    return `${mins} ${lang === 'ru' ? 'мин. назад' : 'min ago'}`;
  };

  const runningCount = ports.filter(p => p.status === 'running').length;
  const stoppedCount = ports.filter(p => p.status !== 'running').length;

  if (loading) {
    return (
      <Card className="p-6">
        <CardLoadingSpinner />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {lang === 'ru' ? 'Статус портов и сервисов' : 'Ports & Services Status'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {lang === 'ru' 
              ? 'Мониторинг запущенных сервисов и их портов' 
              : 'Monitor running services and their ports'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Last update indicator */}
          {lastUpdate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatLastUpdate()}
            </span>
          )}
          
          {/* Auto-refresh toggle */}
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh 
              ? (lang === 'ru' ? 'Авто: вкл' : 'Auto: on')
              : (lang === 'ru' ? 'Авто: выкл' : 'Auto: off')}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPorts()}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {lang === 'ru' ? 'Обновить' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex gap-2">
        <Badge variant="default" className="bg-green-600">
          {runningCount} {lang === 'ru' ? 'активных' : 'running'}
        </Badge>
        {stoppedCount > 0 && (
          <Badge variant="destructive">
            {stoppedCount} {lang === 'ru' ? 'остановлено' : 'stopped'}
          </Badge>
        )}
      </div>

      {/* Current service info */}
      {current && (
        <Card className={`p-4 ${getCardColorClasses('blue').bg} ${getCardColorClasses('blue').border} border`}>
          <div className="flex items-start gap-3">
            <Server className={`w-5 h-5 ${getCardColorClasses('blue').text} mt-0.5`} />
            <div className="flex-1">
              <h3 className={`font-semibold text-sm ${getCardColorClasses('blue').text}`}>
                {lang === 'ru' ? 'Текущий Backend' : 'Current Backend Service'}
              </h3>
              <p className={`text-xs ${getCardColorClasses('blue').text} mt-1`}>
                Flask Backend: <span className="font-mono">{current.host}:{current.port}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={`text-xs ${getCardColorClasses('blue').border} border ${getCardColorClasses('blue').text}`}>
                  {lang === 'ru' ? 'Активен' : 'Active'}
                </Badge>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs ${getCardColorClasses('blue').text} hover:underline inline-flex items-center gap-1`}
                >
                  {current.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Ports list */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">
          {lang === 'ru' ? 'Запущенные сервисы' : 'Running Services'}
        </h3>
        
        {ports.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title={lang === 'ru' ? 'Сервисы не обнаружены' : 'No services detected'}
            description={lang === 'ru' 
              ? 'Не удалось обнаружить запущенные сервисы на ожидаемых портах'
              : 'Could not detect running services on expected ports'}
          />
        ) : (
          <div className="space-y-2">
            {ports.map((port) => (
              <div
                key={port.port}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {port.status === 'running' ? (
                    <div className={`w-10 h-10 rounded-full ${getCardColorClasses('green').bg} flex items-center justify-center`}>
                      <Wifi className={`w-5 h-5 ${getCardColorClasses('green').text}`} />
                    </div>
                  ) : (
                    <div className={`w-10 h-10 rounded-full ${getCardColorClasses('red').bg} flex items-center justify-center`}>
                      <WifiOff className={`w-5 h-5 ${getCardColorClasses('red').text}`} />
                    </div>
                  )}
                  
                  <div>
                    <div className="font-semibold text-sm">{port.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{port.host}:{port.port}</span>
                      <span className="mx-1">•</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {port.type}
                      </Badge>
                      {port.protocol && (
                        <>
                          <span className="mx-1">•</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 uppercase">
                            {port.protocol}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Badge
                  variant={port.status === 'running' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {port.status === 'running' 
                    ? (lang === 'ru' ? 'Работает' : 'Running') 
                    : (lang === 'ru' ? 'Остановлен' : 'Stopped')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Info card */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              {lang === 'ru'
                ? 'Этот экран показывает статус ключевых сервисов системы в реальном времени.'
                : 'This screen shows the status of key system services in real-time.'}
            </p>
            <p className="flex items-center gap-1">
              {autoRefresh && (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {lang === 'ru' 
                    ? `Автообновление каждые ${AUTO_REFRESH_INTERVAL / 1000} секунд`
                    : `Auto-refresh every ${AUTO_REFRESH_INTERVAL / 1000} seconds`}
                </>
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
