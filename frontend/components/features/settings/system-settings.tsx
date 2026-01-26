'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Power, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Globe,
  Cpu,
  HardDrive,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';
import { JournalViewer } from './journal-viewer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ResourceHistoryChart } from './resource-history-chart';
import type { SystemStatus, SystemResources, Event, VersionResponse } from '@/types';

interface CachedData {
  status: SystemStatus | null;
  resources: SystemResources | null;
  version: VersionResponse | null;
  timestamp: number;
}

let globalCache: CachedData = {
  status: null,
  resources: null,
  version: null,
  timestamp: 0,
};

const CACHE_DURATION = 30000;

function formatUptime(uptime: number | string | null | undefined, lang: 'en' | 'ru' = 'en'): string {
  if (!uptime) return '-';

  if (typeof uptime === 'number') {
    const seconds = uptime;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const units = lang === 'ru'
      ? { d: 'д', h: 'ч', m: 'м', s: 'с' }
      : { d: 'd', h: 'h', m: 'm', s: 's' };

    if (days > 0) {
      return `${days}${units.d} ${hours}${units.h} ${minutes}${units.m}`;
    } else if (hours > 0) {
      return `${hours}${units.h} ${minutes}${units.m} ${secs}${units.s}`;
    } else if (minutes > 0) {
      return `${minutes}${units.m} ${secs}${units.s}`;
    } else {
      return `${secs}${units.s}`;
    }
  }

  return uptime;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateStr;
  }
}

function ServiceCard({
  title,
  serviceKey,
  status,
  restartHistory,
  onRestart,
  lang,
}: {
  title: string;
  serviceKey: 'ui' | 'xray' | 'nextjs';
  status: SystemStatus | null;
  restartHistory: Event[];
  onRestart: () => void;
  lang: 'ru' | 'en';
}) {
  const service = serviceKey === 'nextjs' ? status?.nextjs : status?.[serviceKey as 'ui' | 'xray'];
  const isActive = service?.active ?? false;
  const state = service?.state || '-';
  
  // Type guards for service-specific properties
  const uptime = serviceKey !== 'nextjs' && status?.[serviceKey as 'ui' | 'xray']
    ? formatUptime((status[serviceKey as 'ui' | 'xray'] as any)?.uptime, lang)
    : '-';
  const restartCount = serviceKey !== 'nextjs' && status?.[serviceKey as 'ui' | 'xray']
    ? (status[serviceKey as 'ui' | 'xray'] as any)?.restart_count ?? 0
    : 0;
  const restartCount14d = serviceKey !== 'nextjs' && status?.[serviceKey as 'ui' | 'xray']
    ? (status[serviceKey as 'ui' | 'xray'] as any)?.restart_count_14d ?? 0
    : 0;
  
  // Nextjs specific info
  const nextjsPort = serviceKey === 'nextjs' && status?.nextjs ? status.nextjs.port : null;
  const nextjsUrl = serviceKey === 'nextjs' && status?.nextjs ? status.nextjs.url : null;

  const serviceHistory = restartHistory
    .filter((e) => {
      const action = e.action?.toLowerCase() || '';
      if (serviceKey === 'ui') {
        return action.includes('ui') || action.includes('restart_ui');
      } else if (serviceKey === 'xray') {
        return action.includes('xray') && !action.includes('nextjs');
      } else {
        return action.includes('nextjs');
      }
    })
    .slice(0, 5);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">
              {lang === 'ru' ? 'Статус и управление сервисом' : 'Service status and control'}
            </p>
          </div>
          <Badge variant={isActive ? 'default' : 'destructive'} className="text-sm">
            {isActive
              ? (lang === 'ru' ? 'Работает' : 'Running')
              : (lang === 'ru' ? 'Остановлен' : 'Stopped')}
          </Badge>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {lang === 'ru' ? 'Состояние' : 'State'}
            </div>
            <div className="text-sm font-medium">{state}</div>
          </div>
          {serviceKey !== 'nextjs' ? (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {lang === 'ru' ? 'Время работы' : 'Uptime'}
                </div>
                <div className="text-sm font-medium">{uptime}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {lang === 'ru' ? 'Перезапусков (всего)' : 'Restarts (total)'}
                </div>
                <div className="text-sm font-medium">{restartCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {lang === 'ru' ? 'Перезапусков (14 дней)' : 'Restarts (14 days)'}
                </div>
                <div className="text-sm font-medium">{restartCount14d}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {lang === 'ru' ? 'Порт' : 'Port'}
                </div>
                <div className="text-sm font-medium">{nextjsPort || '-'}</div>
              </div>
              {nextjsUrl && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">
                    URL
                  </div>
                  <div className="text-sm font-medium font-mono">{nextjsUrl}</div>
                </div>
              )}
            </>
          )}
        </div>

        {serviceKey !== 'nextjs' && (
          <>
            <Separator />

            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {lang === 'ru' ? 'История запусков (последние 5)' : 'Restart history (last 5)'}
              </div>
              {serviceHistory.length > 0 ? (
                <div className="space-y-2">
                  {serviceHistory.map((event, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {event.severity === 'ERROR' ? (
                          <XCircle className="w-3 h-3 text-destructive" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span>{formatDate(event.ts)}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {event.action}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-2">
                  {lang === 'ru' ? 'Нет данных о запусках' : 'No restart history'}
                </div>
              )}
            </div>

            <Separator />
          </>
        )}

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              {lang === 'ru' ? 'Перезапустить сервис' : 'Restart service'}
            </div>
            <div className="text-xs text-muted-foreground">
              {serviceKey === 'ui'
                ? (lang === 'ru'
                    ? 'Перезапустить панель управления'
                    : 'Restart admin panel')
                : serviceKey === 'xray'
                  ? (lang === 'ru'
                      ? 'Перезапустить Xray процесс'
                      : 'Restart Xray process')
                  : (lang === 'ru'
                      ? 'Перезапустить Next.js сервер'
                      : 'Restart Next.js server')}
            </div>
          </div>
          <Button variant="outline" onClick={onRestart}>
            <Power className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Перезапустить' : 'Restart'}
          </Button>
        </div>

        {serviceKey !== 'nextjs' && (
          <>
            <Separator />
            <div>
              <div className="text-sm font-medium mb-2">
                {lang === 'ru' ? 'Журнал логов' : 'Journal Logs'}
              </div>
              <JournalViewer target={serviceKey} />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export function SystemSettings() {
  const [status, setStatus] = useState<SystemStatus | null>(globalCache.status);
  const [resources, setResources] = useState<SystemResources | null>(globalCache.resources);
  const [version, setVersion] = useState<VersionResponse | null>(globalCache.version);
  const [loading, setLoading] = useState(!globalCache.status);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'ui' | 'xray' | 'nextjs' | 'all';
    loading: boolean;
  }>({ open: false, type: 'ui', loading: false });
  const { lang } = useAppStore();

  useEffect(() => {
    loadData(true);
  }, []);

  const loadData = async (isInitial = false) => {
    const now = Date.now();
    const cacheAge = now - globalCache.timestamp;

    if (!isInitial && globalCache.status && cacheAge < CACHE_DURATION) {
      setStatus(globalCache.status);
      setResources(globalCache.resources);
      setVersion(globalCache.version);
      setLoading(false);
      return;
    }

    if (globalCache.status && !isInitial) {
      setStatus(globalCache.status);
      setResources(globalCache.resources);
      setVersion(globalCache.version);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [statusRes, resourcesRes, versionRes] = await Promise.all([
        apiClient.getSystemStatus(),
        apiClient.getSystemResources(),
        apiClient.getVersion(),
      ]);

      globalCache = {
        status: statusRes.data,
        resources: resourcesRes.data,
        version: versionRes.data,
        timestamp: Date.now(),
      };

      setStatus(statusRes.data);
      setResources(resourcesRes.data);
      setVersion(versionRes.data);
    } catch (error) {
      toast.error(handleApiError(error));
      if (globalCache.status) {
        setStatus(globalCache.status);
        setResources(globalCache.resources);
        setVersion(globalCache.version);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRestart = async (target: 'ui' | 'xray' | 'nextjs' | 'all') => {
    setConfirmDialog(prev => ({ ...prev, loading: true }));

    try {
      await apiClient.restartService(target);
      toast.success(
        lang === 'ru' 
          ? `${target === 'all' ? 'Сервер' : target.toUpperCase()} перезапускается...` 
          : `${target === 'all' ? 'Server' : target.toUpperCase()} restarting...`
      );
      
      setConfirmDialog({ open: false, type: 'ui', loading: false });
      
      if (target === 'ui' || target === 'all') {
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setTimeout(() => loadData(true), 2000);
      }
    } catch (error) {
      toast.error(handleApiError(error));
      setConfirmDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const openConfirmDialog = (type: 'ui' | 'xray' | 'nextjs' | 'all') => {
    setConfirmDialog({ open: true, type, loading: false });
  };

  if (loading && !status) {
    return (
      <Card className="p-6">
        <CardLoadingSpinner />
      </Card>
    );
  }

  const restartHistory = status?.restart_history || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {lang === 'ru' ? 'Управление системой' : 'System Management'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'ru'
              ? 'Управление сервисами и мониторинг ресурсов'
              : 'Manage services and monitor resources'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {lang === 'ru' ? 'Обновить' : 'Refresh'}
        </Button>
      </div>

      {refreshing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          {lang === 'ru' ? 'Обновление данных...' : 'Updating data...'}
        </div>
      )}

      {/* Version and Resources */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Version Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {lang === 'ru' ? 'Версия приложения' : 'App Version'}
                </div>
                <div className="font-semibold">{version?.name || 'Xray Report UI'}</div>
              </div>
            </div>
            <Badge variant="outline" className="text-lg">
              v{version?.version || '?.?.?'}
            </Badge>
          </div>
        </Card>

        {/* Resources Card */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">CPU</div>
                <div className="font-semibold">{resources?.cpu?.toFixed(1) || 0}%</div>
              </div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">RAM</div>
                <div className="font-semibold">
                  {resources?.ram?.toFixed(1) || 0}%
                  <span className="text-xs text-muted-foreground ml-1">
                    ({resources?.ram_used_gb?.toFixed(1) || 0}/{resources?.ram_total_gb?.toFixed(1) || 0} GB)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Resource History Chart */}
      <ResourceHistoryChart />

      {/* Service Cards */}
      <ServiceCard
        title="Xray Service"
        serviceKey="xray"
        status={status}
        restartHistory={restartHistory}
        onRestart={() => openConfirmDialog('xray')}
        lang={lang}
      />

      <ServiceCard
        title="UI Service (Flask)"
        serviceKey="ui"
        status={status}
        restartHistory={restartHistory}
        onRestart={() => openConfirmDialog('ui')}
        lang={lang}
      />

      <ServiceCard
        title="Next.js Frontend"
        serviceKey="nextjs"
        status={status}
        restartHistory={restartHistory}
        onRestart={() => openConfirmDialog('nextjs')}
        lang={lang}
      />

      {/* Danger Zone */}
      <Card className="p-6 border-destructive/50">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {lang === 'ru' ? 'Опасная зона' : 'Danger Zone'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lang === 'ru'
                ? 'Действия, требующие осторожности'
                : 'Actions requiring caution'}
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-destructive">
                {lang === 'ru' ? 'Перезагрузить сервер' : 'Reboot Server'}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === 'ru'
                  ? 'Перезагрузить ВЕСЬ СЕРВЕР (операционную систему)'
                  : 'Reboot ENTIRE SERVER (operating system)'}
              </div>
            </div>
            <Button variant="destructive" onClick={() => openConfirmDialog('all')}>
              <Power className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Перезагрузить' : 'Reboot'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={
          confirmDialog.type === 'all'
            ? (lang === 'ru' ? 'Перезагрузить сервер?' : 'Reboot server?')
            : (lang === 'ru' ? `Перезапустить ${confirmDialog.type.toUpperCase()}?` : `Restart ${confirmDialog.type.toUpperCase()}?`)
        }
        description={
          confirmDialog.type === 'all'
            ? (lang === 'ru' 
                ? 'Это перезагрузит операционную систему. Все подключения будут потеряны.' 
                : 'This will reboot the operating system. All connections will be lost.')
            : confirmDialog.type === 'ui'
              ? (lang === 'ru'
                  ? 'Страница будет перезагружена после перезапуска сервиса.'
                  : 'The page will reload after service restart.')
              : (lang === 'ru'
                  ? 'Текущие VPN подключения могут быть временно разорваны.'
                  : 'Current VPN connections may be temporarily dropped.')
        }
        variant={confirmDialog.type === 'all' ? 'destructive' : 'warning'}
        confirmText={
          confirmDialog.type === 'all'
            ? (lang === 'ru' ? 'Перезагрузить' : 'Reboot')
            : (lang === 'ru' ? 'Перезапустить' : 'Restart')
        }
        onConfirm={() => handleRestart(confirmDialog.type)}
        loading={confirmDialog.loading}
      />
    </div>
  );
}
