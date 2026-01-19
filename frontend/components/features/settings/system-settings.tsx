'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Power, RefreshCw, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';
import { JournalViewer } from './journal-viewer';
import type { SystemStatus, Event } from '@/types';

interface CachedData {
  status: SystemStatus | null;
  timestamp: number;
}

// Кэш данных в памяти компонента
let globalCache: CachedData = {
  status: null,
  timestamp: 0,
};

const CACHE_DURATION = 30000; // 30 секунд

function formatUptime(uptime: number | string | null | undefined): string {
  if (!uptime) return '-';
  
  // Если это число (секунды), форматируем его
  if (typeof uptime === 'number') {
    const seconds = uptime;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}д ${hours}ч ${minutes}м`;
    } else if (hours > 0) {
      return `${hours}ч ${minutes}м ${secs}с`;
    } else if (minutes > 0) {
      return `${minutes}м ${secs}с`;
    } else {
      return `${secs}с`;
    }
  }
  
  // Если это строка, возвращаем как есть
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
  serviceKey: 'ui' | 'xray';
  status: SystemStatus | null;
  restartHistory: Event[];
  onRestart: () => void;
  lang: 'ru' | 'en';
}) {
  const service = status?.[serviceKey];
  const isActive = service?.active ?? false;
  const state = service?.state || '-';
  const uptime = formatUptime(service?.uptime);
  const restartCount = service?.restart_count ?? 0;
  const restartCount14d = service?.restart_count_14d ?? 0;

  // Фильтруем историю запусков для этой системы
  const serviceHistory = restartHistory
    .filter((e) => {
      const action = e.action?.toLowerCase() || '';
      if (serviceKey === 'ui') {
        return action.includes('ui') || action.includes('restart_ui');
      } else {
        return action.includes('xray') || action.includes('restart_xray');
      }
    })
    .slice(0, 5); // Последние 5 запусков

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Заголовок и статус */}
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

        {/* Детали статуса */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {lang === 'ru' ? 'Состояние' : 'State'}
            </div>
            <div className="text-sm font-medium">{state}</div>
          </div>
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
        </div>

        <Separator />

        {/* История запусков */}
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

        {/* Кнопка перезапуска */}
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
                : (lang === 'ru'
                    ? 'Перезапустить Xray процесс'
                    : 'Restart Xray process')}
            </div>
          </div>
          <Button variant="outline" onClick={onRestart}>
            <Power className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Перезапустить' : 'Restart'}
          </Button>
        </div>

        <Separator />

        {/* Журнал логов */}
        <div>
          <div className="text-sm font-medium mb-2">
            {lang === 'ru' ? 'Журнал логов' : 'Journal Logs'}
          </div>
          <JournalViewer target={serviceKey} />
        </div>
      </div>
    </Card>
  );
}

export function SystemSettings() {
  const [status, setStatus] = useState<SystemStatus | null>(globalCache.status);
  const [loading, setLoading] = useState(!globalCache.status);
  const [refreshing, setRefreshing] = useState(false);
  const { lang } = useAppStore();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Загружаем данные при монтировании
    loadStatus(true);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const loadStatus = async (isInitial = false) => {
    const now = Date.now();
    const cacheAge = now - globalCache.timestamp;

    // Если есть свежий кэш и это не принудительное обновление, используем кэш
    if (!isInitial && globalCache.status && cacheAge < CACHE_DURATION) {
      setStatus(globalCache.status);
      setLoading(false);
      return;
    }

    // Показываем старые данные сразу, если они есть
    if (globalCache.status && !isInitial) {
      setStatus(globalCache.status);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await apiClient.getSystemStatus();
      const newStatus = response.data;
      
      // Обновляем кэш
      globalCache = {
        status: newStatus,
        timestamp: Date.now(),
      };

      setStatus(newStatus);
    } catch (error) {
      toast.error(handleApiError(error));
      // В случае ошибки используем кэш, если он есть
      if (globalCache.status) {
        setStatus(globalCache.status);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRestartUI = async () => {
    if (
      !confirm(
        lang === 'ru'
          ? 'Перезапустить UI? Страница будет перезагружена.'
          : 'Restart UI? The page will be reloaded.'
      )
    ) {
      return;
    }

    try {
      await apiClient.restartService('ui');
      toast.success(
        lang === 'ru' ? 'UI перезапускается...' : 'UI restarting...'
      );
      // Обновляем статус через небольшую задержку
      setTimeout(() => {
        loadStatus(true);
        setTimeout(() => window.location.reload(), 2000);
      }, 1000);
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };

  const handleRestartXray = async () => {
    if (
      !confirm(
        lang === 'ru'
          ? 'Перезапустить Xray? Это перезапустит только процесс Xray, не весь сервер.'
          : 'Restart Xray? This will restart only the Xray process, not the entire server.'
      )
    ) {
      return;
    }

    try {
      await apiClient.restartService('xray');
      toast.success(
        lang === 'ru' ? 'Xray перезапускается...' : 'Xray restarting...'
      );
      // Обновляем статус через небольшую задержку
      setTimeout(() => {
        loadStatus(true);
      }, 2000);
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };

  const handleRestartSystem = async () => {
    if (
      !confirm(
        lang === 'ru'
          ? 'ВНИМАНИЕ: Перезагрузить ВЕСЬ СЕРВЕР? Это перезагрузит операционную систему!'
          : 'WARNING: Reboot ENTIRE SERVER? This will reboot the operating system!'
      )
    ) {
      return;
    }

    try {
      await apiClient.restartService('all');
      toast.success(
        lang === 'ru' ? 'Сервер перезагружается...' : 'Server rebooting...'
      );
    } catch (error) {
      toast.error(handleApiError(error));
    }
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
      {/* Заголовок с кнопкой обновления */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {lang === 'ru' ? 'Управление системами' : 'Systems Management'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'ru'
              ? 'Управление сервисами Xray и UI'
              : 'Manage Xray and UI services'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadStatus(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {lang === 'ru' ? 'Обновить' : 'Refresh'}
        </Button>
      </div>

      {/* Индикатор обновления */}
      {refreshing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          {lang === 'ru' ? 'Обновление данных...' : 'Updating data...'}
        </div>
      )}

      {/* Версия приложения */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {lang === 'ru' ? 'Версия приложения:' : 'App Version:'}
          </span>
          <Badge variant="outline">v2.1</Badge>
        </div>
      </Card>

      {/* Карточки систем */}
      <ServiceCard
        title={lang === 'ru' ? 'Xray Service' : 'Xray Service'}
        serviceKey="xray"
        status={status}
        restartHistory={restartHistory}
        onRestart={handleRestartXray}
        lang={lang}
      />

      <ServiceCard
        title={lang === 'ru' ? 'UI Service' : 'UI Service'}
        serviceKey="ui"
        status={status}
        restartHistory={restartHistory}
        onRestart={handleRestartUI}
        lang={lang}
      />

      {/* Опасная зона - перезагрузка сервера */}
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
            <Button variant="destructive" onClick={handleRestartSystem}>
              <Power className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Перезагрузить сервер' : 'Reboot Server'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
