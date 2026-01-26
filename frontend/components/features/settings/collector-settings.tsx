'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  RefreshCw, 
  Play, 
  AlertCircle,
  Clock,
  FileText,
  Calendar,
  Terminal,
  Save,
  X,
  HardDrive,
  CalendarRange,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import type { CollectorStatus, CronJob } from '@/types';

// Helper: format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper: parse cron schedule to human readable
function parseCronSchedule(schedule: string, lang: 'ru' | 'en'): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  // Simple cases
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    // Daily
    if (hour !== '*' && minute !== '*') {
      const h = hour.padStart(2, '0');
      const m = minute.padStart(2, '0');
      return lang === 'ru' 
        ? `Ежедневно в ${h}:${m}` 
        : `Daily at ${h}:${m}`;
    }
    if (hour === '*' && minute !== '*') {
      return lang === 'ru'
        ? `Каждый час в ${minute} минут`
        : `Every hour at minute ${minute}`;
    }
  }
  
  if (dayOfWeek !== '*' && dayOfMonth === '*') {
    // Weekly
    const days = {
      '0': lang === 'ru' ? 'воскресенье' : 'Sunday',
      '1': lang === 'ru' ? 'понедельник' : 'Monday',
      '2': lang === 'ru' ? 'вторник' : 'Tuesday',
      '3': lang === 'ru' ? 'среда' : 'Wednesday',
      '4': lang === 'ru' ? 'четверг' : 'Thursday',
      '5': lang === 'ru' ? 'пятница' : 'Friday',
      '6': lang === 'ru' ? 'суббота' : 'Saturday',
    };
    const dayName = days[dayOfWeek as keyof typeof days] || dayOfWeek;
    if (hour !== '*' && minute !== '*') {
      const h = hour.padStart(2, '0');
      const m = minute.padStart(2, '0');
      return lang === 'ru'
        ? `Каждый ${dayName} в ${h}:${m}`
        : `Every ${dayName} at ${h}:${m}`;
    }
  }
  
  return schedule;
}

export function CollectorSettings() {
  const [status, setStatus] = useState<CollectorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [includeToday, setIncludeToday] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<{
    jobIndex: number;
    script: string;
    schedule: string;
  } | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
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

  const handleToggle = async (enabled: boolean) => {
    try {
      setToggling(true);
      const response = await apiClient.toggleCollector(enabled);
      const data = response.data;
      
      const action = enabled 
        ? (lang === 'ru' ? 'включен' : 'enabled')
        : (lang === 'ru' ? 'выключен' : 'disabled');
      
      toast.success(
        lang === 'ru'
          ? `✓ Сборщик ${action}`
          : `✓ Collector ${action}`,
        {
          description: lang === 'ru'
            ? `${data.jobs_modified} задач ${enabled ? 'раскомментировано' : 'закомментировано'} в cron`
            : `${data.jobs_modified} jobs ${enabled ? 'uncommented' : 'commented'} in cron`,
          duration: 4000,
        }
      );
      
      await loadStatus();
    } catch (error) {
      toast.error(
        lang === 'ru' ? 'Ошибка переключения сборщика' : 'Error toggling collector',
        {
          description: handleApiError(error),
          duration: 5000,
        }
      );
    } finally {
      setToggling(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setRunning(true);
      setRunOutput(null);
      
      const response = await apiClient.runCollector(includeToday);
      
      setRunOutput(response.data.output);
      
      const scriptsRun = response.data.scripts_run || 0;
      
      if (response.data.success) {
        toast.success(
          lang === 'ru' 
            ? `✓ Выполнено ${scriptsRun} скриптов${includeToday ? ' (за сегодня)' : ''}` 
            : `✓ Ran ${scriptsRun} scripts${includeToday ? ' (for today)' : ''}`,
          {
            description: response.data.message,
            duration: 4000,
          }
        );
      } else {
        toast.error(
          lang === 'ru' 
            ? `Ошибка выполнения (код ${response.data.return_code})` 
            : `Execution failed (code ${response.data.return_code})`
        );
      }
      
      // Reload status after run
      await loadStatus();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setRunning(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!editingSchedule) return;
    
    try {
      setSavingSchedule(true);
      await apiClient.updateCronSchedule(editingSchedule.script, editingSchedule.schedule);
      
      toast.success(
        lang === 'ru' ? 'Расписание обновлено' : 'Schedule updated'
      );
      
      setEditingSchedule(null);
      await loadStatus();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleJob = async (script: string, enabled: boolean) => {
    const jobName = script.replace('.sh', '').replace('xray_', '');
    
    try {
      setToggling(true);
      const response = await apiClient.toggleCollector(enabled, script);
      const data = response.data;
      
      // Show detailed success message
      const action = enabled 
        ? (lang === 'ru' ? 'включена' : 'enabled')
        : (lang === 'ru' ? 'выключена' : 'disabled');
      
      const cronAction = data.cron_modified
        ? (lang === 'ru' 
            ? (enabled ? '(строка раскомментирована в cron)' : '(строка закомментирована в cron)')
            : (enabled ? '(line uncommented in cron)' : '(line commented in cron)'))
        : '';
      
      toast.success(
        lang === 'ru'
          ? `✓ Задача "${jobName}" ${action} ${cronAction}`
          : `✓ Job "${jobName}" ${action} ${cronAction}`,
        {
          description: data.message,
          duration: 4000,
        }
      );
      
      await loadStatus();
    } catch (error) {
      toast.error(
        lang === 'ru' 
          ? `Ошибка при переключении "${jobName}"` 
          : `Error toggling "${jobName}"`,
        {
          description: handleApiError(error),
          duration: 5000,
        }
      );
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <CardLoadingSpinner />
      </Card>
    );
  }

  const cron = status?.cron;
  const hasJobs = cron?.found && cron?.all_jobs && cron.all_jobs.length > 0;

  return (
    <div className="space-y-4">
      {/* Header Row: Status + Manual Run side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Card - takes 2/3 */}
        <Card className="p-4 lg:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold">
                  {lang === 'ru' ? 'Сборщик статистики' : 'Statistics Collector'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {lang === 'ru'
                    ? 'Управление cron задачами сборщика статистики'
                    : 'Manage statistics collector cron jobs'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="collector-toggle" className="text-sm">
                    {lang === 'ru' ? 'Сбор данных' : 'Data collection'}
                  </Label>
                  <Switch
                    id="collector-toggle"
                    checked={status?.enabled ?? false}
                    onCheckedChange={handleToggle}
                    disabled={toggling || !hasJobs}
                  />
                </div>
                
                <Button size="sm" variant="outline" onClick={loadStatus}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Обновить' : 'Refresh'}
                </Button>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={status?.enabled ? 'default' : 'secondary'}>
                {status?.enabled 
                  ? (lang === 'ru' ? 'Включен' : 'Enabled')
                  : (lang === 'ru' ? 'Выключен' : 'Disabled')}
              </Badge>
              <Badge variant="outline">
                <FileText className="w-3 h-3 mr-1" />
                {status?.files_count ?? 0} {lang === 'ru' ? 'файлов' : 'files'}
              </Badge>
              {status?.lag_days !== null && status?.lag_days !== undefined && (
                <Badge variant={status.lag_days > 2 ? 'destructive' : 'outline'}>
                  <Clock className="w-3 h-3 mr-1" />
                  {status.lag_days === 0 
                    ? (lang === 'ru' ? 'Данные актуальны' : 'Data up to date')
                    : `${status.lag_days} ${lang === 'ru' ? 'дней назад' : 'days ago'}`}
                </Badge>
              )}
              {status?.active_jobs_count !== undefined && (
                <Badge variant="outline">
                  {status.active_jobs_count}/{status.total_jobs_count} {lang === 'ru' ? 'активных задач' : 'active jobs'}
                </Badge>
              )}
            </div>

            {/* Warning if disabled */}
            {!status?.enabled && status?.disabled_reason && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">
                    <p className="font-medium">{lang === 'ru' ? 'Причина отключения:' : 'Disabled reason:'}</p>
                    <p className="text-xs mt-1">{status.disabled_reason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning for collector lag */}
            {status?.enabled && (status?.lag_days ?? 0) > 2 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-red-900 dark:text-red-100">
                    <div className="font-medium">
                      {lang === 'ru' ? 'Устаревшие данные сборщика' : 'Collector Data Outdated'}
                    </div>
                    <div className="text-red-700 dark:text-red-300 mt-1">
                      {lang === 'ru'
                        ? `Данные не обновлялись ${status.lag_days} дней. Проверьте задачи cron и логи.`
                        : `Data hasn't been updated for ${status.lag_days} days. Check cron jobs and logs.`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Manual Run Card - takes 1/3 */}
        <Card className="p-4 flex flex-col">
          <div className="flex-1">
            <h4 className="font-medium">
              {lang === 'ru' ? 'Ручной запуск' : 'Manual Run'}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === 'ru'
                ? 'Запустить все скрипты сбора'
                : 'Run all collector scripts'}
            </p>
          </div>
          
          {/* Include today checkbox */}
          <div className="flex items-center gap-2 my-3 py-2 px-2 bg-muted/50 rounded">
            <Switch
              id="include-today"
              checked={includeToday}
              onCheckedChange={setIncludeToday}
              disabled={running}
              className="scale-90"
            />
            <Label htmlFor="include-today" className="text-xs cursor-pointer">
              {lang === 'ru' 
                ? 'Собрать за сегодня (неполный день)' 
                : 'Collect for today (incomplete)'}
            </Label>
          </div>
          
          <Button 
            onClick={handleRunNow} 
            disabled={running}
            variant={running ? 'secondary' : 'default'}
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {lang === 'ru' ? 'Выполняется...' : 'Running...'}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                {lang === 'ru' 
                  ? (includeToday ? 'Собрать за сегодня' : 'Собрать за вчера')
                  : (includeToday ? 'Collect today' : 'Collect yesterday')}
              </>
            )}
          </Button>
        </Card>
      </div>

      {/* Output of manual run */}
      {runOutput && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4" />
            <span className="text-sm font-medium">
              {lang === 'ru' ? 'Результат выполнения:' : 'Execution output:'}
            </span>
          </div>
          <pre className="bg-muted p-3 rounded-lg overflow-auto max-h-[150px] text-xs font-mono whitespace-pre-wrap">
            {runOutput}
          </pre>
        </Card>
      )}

      {/* Cron Jobs Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {lang === 'ru' ? 'Cron задачи' : 'Cron Jobs'}
          </h4>

          {!hasJobs ? (
            <EmptyState
              icon={Calendar}
              title={lang === 'ru' ? 'Cron задачи не найдены' : 'No cron jobs found'}
              description={
                lang === 'ru'
                  ? 'Создайте файл /etc/cron.d/xray-usage с расписанием сборщика'
                  : 'Create file /etc/cron.d/xray-usage with collector schedule'
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {cron?.all_jobs?.map((job: CronJob, idx: number) => {
                const isEditing = editingSchedule?.jobIndex === idx;
                const stats = job.stats;
                
                return (
                  <Card key={idx} className="p-0 bg-muted/30 overflow-hidden flex flex-col relative">
                    {/* Last run badge - top right corner */}
                    {stats?.last_run && (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 bg-background/80 backdrop-blur-sm"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {stats.last_run}
                      </Badge>
                    )}
                    
                    {/* BLOCK 1: Header with name, status */}
                    <div className="px-3 py-2 pt-8 bg-muted/50 border-b border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={job.status?.active ?? false}
                          onCheckedChange={(checked) => handleToggleJob(job.script || '', checked)}
                          disabled={toggling}
                          className="scale-75"
                        />
                        <span className="font-semibold text-sm truncate">
                          {job.script?.replace('.sh', '').replace('xray_', '') || (lang === 'ru' ? 'Задача' : 'Job')}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                        {job.description || (lang === 'ru' ? 'Скрипт сборщика статистики' : 'Statistics collector script')}
                      </p>
                    </div>

                    {/* BLOCK 2: Stats row - files, size, period in one line */}
                    <div className="px-3 py-2 border-b border-border/50">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          <strong>{stats?.files_count || 0}</strong>
                          <span className="text-muted-foreground">{lang === 'ru' ? 'файлов' : 'files'}</span>
                        </div>
                        
                        {stats?.total_size_bytes !== undefined && stats.total_size_bytes > 0 && (
                          <div className="flex items-center gap-1">
                            <HardDrive className="w-3.5 h-3.5 text-purple-500" />
                            <strong>{formatBytes(stats.total_size_bytes)}</strong>
                          </div>
                        )}
                        
                        {stats?.date_range?.oldest && stats.date_range.newest && (
                          <div className="flex items-center gap-1">
                            <CalendarRange className="w-3.5 h-3.5 text-green-500" />
                            <strong>
                              {stats.date_range.oldest.slice(5)} — {stats.date_range.newest.slice(5)}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BLOCK 3: Schedule + Recent files */}
                    <div className="px-3 py-2 flex-1">
                      {/* Schedule */}
                      {isEditing ? (
                        <div className="flex items-center gap-1 mb-2">
                          <Input
                            value={editingSchedule.schedule}
                            onChange={(e) => setEditingSchedule(prev => 
                              prev ? { ...prev, schedule: e.target.value } : null
                            )}
                            placeholder="* * * * *"
                            className="font-mono text-[10px] h-6 flex-1"
                          />
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSaveSchedule} disabled={savingSchedule}>
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingSchedule(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center gap-1.5 text-[11px] mb-2 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
                          onClick={() => job.script && setEditingSchedule({
                            jobIndex: idx,
                            script: job.script,
                            schedule: job.schedule || '',
                          })}
                          title={lang === 'ru' ? 'Нажмите для редактирования' : 'Click to edit'}
                        >
                          <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">
                            {parseCronSchedule(job.schedule || '', lang)}
                          </span>
                          <code className="bg-background px-1 py-0.5 rounded text-[9px] ml-auto">
                            {job.schedule}
                          </code>
                        </div>
                      )}

                      {/* Recent Files */}
                      {stats?.created_files && stats.created_files.length > 0 && (
                        <div>
                          <div className="text-[10px] text-muted-foreground mb-1">
                            {lang === 'ru' ? 'Последние:' : 'Recent:'}
                          </div>
                          <div className="flex flex-wrap gap-0.5">
                            {stats.created_files.slice(0, 5).map((file, fileIdx) => {
                              // Extract full date YYYY-MM-DD from filename
                              const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
                              const fullDate = dateMatch ? dateMatch[1] : file;
                              return (
                                <code 
                                  key={fileIdx}
                                  className="text-[9px] bg-background px-1 py-0.5 rounded"
                                  title={file}
                                >
                                  {fullDate}
                                </code>
                              );
                            })}
                            {stats.created_files.length > 5 && (
                              <span className="text-[9px] text-muted-foreground px-1">
                                +{stats.created_files.length - 5}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Errors */}
                      {stats?.errors_count !== undefined && stats.errors_count > 0 && (
                        <div className="flex items-center gap-1 text-red-600 text-[11px] mt-2">
                          <AlertCircle className="w-3 h-3" />
                          <span>{lang === 'ru' ? 'Ошибок:' : 'Errors:'}</span>
                          <strong>{stats.errors_count}</strong>
                        </div>
                      )}
                    </div>

                    {/* BLOCK 4: Data folder path */}
                    <div className="px-3 py-2 bg-muted/30 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <Terminal className="w-3 h-3 text-muted-foreground shrink-0" />
                        <code className="text-muted-foreground truncate" title={status?.usage_dir || '/var/log/xray/usage'}>
                          {status?.usage_dir || '/var/log/xray/usage'}
                        </code>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              {lang === 'ru'
                ? 'Сборщик статистики читает логи Xray и создает CSV файлы с данными об использовании.'
                : 'Statistics collector reads Xray logs and creates CSV files with usage data.'}
            </p>
            <p>
              {lang === 'ru'
                ? `Директория данных: ${status?.usage_dir || '/var/log/xray/usage'}`
                : `Data directory: ${status?.usage_dir || '/var/log/xray/usage'}`}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
