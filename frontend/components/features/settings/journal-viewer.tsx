'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Pause, Play, Download, Copy } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';

export function JournalViewer({ target = 'ui' }: { target?: 'ui' | 'xray' }) {
  const [lines, setLines] = useState<number>(100);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [timezone, setTimezone] = useState<string>('');
  const { lang } = useAppStore();

  useEffect(() => {
    loadLogs();
  }, [target, lines]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, target, lines]);

  const loadLogs = async () => {
    try {
      const response = await apiClient.getJournal({ target, limit: lines });
      setLogs(response.data.journal || (lang === 'ru' ? 'Нет данных' : 'No logs available'));
      if (response.data.timezone) {
        setTimezone(response.data.timezone);
      }
      setLoading(false);
    } catch (error) {
      toast.error(handleApiError(error));
      setLoading(false);
    }
  };

  const parseLogLine = (line: string) => {
    if (line.includes('ERROR') || line.includes('error')) {
      return 'text-red-500';
    }
    if (line.includes('WARN') || line.includes('warn')) {
      return 'text-yellow-500';
    }
    if (line.includes('INFO') || line.includes('info')) {
      return 'text-blue-500';
    }
    return 'text-foreground';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
    toast.success(lang === 'ru' ? 'Логи скопированы' : 'Logs copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${target}-journal-${new Date().toISOString().slice(0, 10)}.log`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success(lang === 'ru' ? 'Файл скачан' : 'File downloaded');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg">
              {lang === 'ru' ? 'Журнал логов' : 'Journal Logs'}
            </CardTitle>
            {timezone && (
              <p className="text-xs text-muted-foreground mt-1">
                {lang === 'ru' ? 'Часовой пояс:' : 'Timezone:'} {timezone}
              </p>
            )}
          </div>
          <Badge variant={autoRefresh ? 'default' : 'outline'}>
            {autoRefresh 
              ? (lang === 'ru' ? 'Авто-обновление: вкл' : 'Auto-refresh: on')
              : (lang === 'ru' ? 'Авто-обновление: выкл' : 'Auto-refresh: off')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          <Select value={lines.toString()} onValueChange={(v) => setLines(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 {lang === 'ru' ? 'строк' : 'lines'}</SelectItem>
              <SelectItem value="100">100 {lang === 'ru' ? 'строк' : 'lines'}</SelectItem>
              <SelectItem value="200">200 {lang === 'ru' ? 'строк' : 'lines'}</SelectItem>
              <SelectItem value="500">500 {lang === 'ru' ? 'строк' : 'lines'}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLogs()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {lang === 'ru' ? 'Обновить' : 'Refresh'}
          </Button>

          <Button
            variant={autoRefresh ? 'destructive' : 'default'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                {lang === 'ru' ? 'Стоп' : 'Pause'}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                {lang === 'ru' ? 'Авто' : 'Auto'}
              </>
            )}
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
          >
            <Copy className="w-4 h-4 mr-1" />
            {lang === 'ru' ? 'Копировать' : 'Copy'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-1" />
            {lang === 'ru' ? 'Скачать' : 'Download'}
          </Button>
        </div>

        {/* Logs Display */}
        <div className="bg-muted/50 rounded-lg p-4 overflow-auto max-h-[500px]">
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {logs.split('\n').map((line, idx) => (
              <div key={idx} className={parseLogLine(line)}>
                {line}
              </div>
            ))}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
