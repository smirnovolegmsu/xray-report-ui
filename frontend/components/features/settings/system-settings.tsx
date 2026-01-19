'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Power, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';
import { JournalViewer } from './journal-viewer';

export function SystemSettings() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSystemStatus();
      setStatus(response.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRestartUI = async () => {
    if (!confirm(
      lang === 'ru'
        ? 'Перезапустить UI? Страница будет перезагружена.'
        : 'Restart UI? The page will be reloaded.'
    )) {
      return;
    }

    try {
      await apiClient.restartService('ui');
      toast.success(
        lang === 'ru' ? 'UI перезапускается...' : 'UI restarting...'
      );
      setTimeout(() => window.location.reload(), 3000);
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };

  const handleRestartSystem = async () => {
    if (!confirm(
      lang === 'ru'
        ? 'ВНИМАНИЕ: Перезагрузить всю систему? Это перезапустит сервер!'
        : 'WARNING: Restart entire system? This will reboot the server!'
    )) {
      return;
    }

    try {
      await apiClient.restartService('all');
      toast.success(
        lang === 'ru' ? 'Система перезагружается...' : 'System rebooting...'
      );
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <CardLoadingSpinner />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {lang === 'ru' ? 'Информация о системе' : 'System Information'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {lang === 'ru' ? 'Версия и статус сервисов' : 'Version and services status'}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={loadStatus}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Обновить' : 'Refresh'}
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {lang === 'ru' ? 'Версия приложения:' : 'App Version:'}
              </span>
              <Badge variant="outline">v2.0</Badge>
            </div>

            {status && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Xray:</span>
                  <Badge variant={status.xray_active ? 'default' : 'destructive'}>
                    {status.xray_active
                      ? (lang === 'ru' ? 'Работает' : 'Running')
                      : (lang === 'ru' ? 'Остановлен' : 'Stopped')}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">UI:</span>
                  <Badge variant="default">
                    {lang === 'ru' ? 'Работает' : 'Running'}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              {lang === 'ru' ? 'Опасная зона' : 'Danger Zone'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lang === 'ru'
                ? 'Действия, требующие осторожности'
                : 'Actions requiring caution'}
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {lang === 'ru' ? 'Перезапустить UI' : 'Restart UI'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === 'ru'
                    ? 'Перезапустить панель управления'
                    : 'Restart admin panel'}
                </div>
              </div>
              <Button variant="outline" onClick={handleRestartUI}>
                <Power className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Перезапустить' : 'Restart'}
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-destructive">
                  {lang === 'ru' ? 'Перезагрузить систему' : 'Reboot System'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === 'ru'
                    ? 'Перезагрузить весь сервер'
                    : 'Reboot entire server'}
                </div>
              </div>
              <Button variant="destructive" onClick={handleRestartSystem}>
                <Power className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Перезагрузить' : 'Reboot'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Journal Logs Viewer */}
      <JournalViewer />
    </div>
  );
}
