'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';

export function CollectorSettings() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCollectorStatus();
      setStatus(response.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  const cron = status?.cron || {};

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {lang === 'ru' ? 'Сборщик статистики' : 'Statistics Collector'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lang === 'ru'
                ? 'Статус cron задач сборщика'
                : 'Cron jobs status for collector'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={loadStatus}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Обновить' : 'Refresh'}
          </Button>
        </div>

        {cron.found ? (
          <div className="space-y-4">
            {cron.all_jobs?.map((job: any, idx: number) => (
              <Card key={idx} className="p-4 bg-muted/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {job.status?.active ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-sm">
                        {job.script || lang === 'ru' ? 'Cron задача' : 'Cron Job'}
                      </span>
                    </div>
                    <Badge variant={job.status?.active ? 'default' : 'secondary'}>
                      {job.status?.active
                        ? (lang === 'ru' ? 'Активна' : 'Active')
                        : (lang === 'ru' ? 'Неактивна' : 'Inactive')}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {job.description || (lang === 'ru' ? 'Скрипт сборщика статистики' : 'Statistics collector script')}
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">
                        {lang === 'ru' ? 'Расписание:' : 'Schedule:'}
                      </span>
                      <code className="ml-2 bg-background px-2 py-0.5 rounded">
                        {job.schedule || '—'}
                      </code>
                    </div>
                  </div>

                  {job.stats && (
                    <div className="flex items-center gap-4 text-xs">
                      <span>
                        <span className="text-muted-foreground">
                          {lang === 'ru' ? 'Запусков:' : 'Runs:'}
                        </span>
                        <strong className="ml-1">{job.stats.runs_count || 0}</strong>
                      </span>
                      {job.stats.errors_count > 0 && (
                        <span className="text-red-600">
                          <span>
                            {lang === 'ru' ? 'Ошибок:' : 'Errors:'}
                          </span>
                          <strong className="ml-1">{job.stats.errors_count}</strong>
                        </span>
                      )}
                      {job.stats.last_run && (
                        <span className="text-muted-foreground">
                          {lang === 'ru' ? 'Последний:' : 'Last:'}
                          <strong className="ml-1">{job.stats.last_run}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {lang === 'ru'
              ? 'Cron задачи не найдены'
              : 'No cron jobs found'}
          </div>
        )}
      </div>
    </Card>
  );
}
