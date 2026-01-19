'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Pause, Play } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import type { LogsApiResponse } from '@/types';

export function JournalViewer() {
  const [service, setService] = useState<'xray-report-ui' | 'xray'>('xray-report-ui');
  const [lines, setLines] = useState<number>(100);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [service, lines]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, service, lines]);

  const loadLogs = async () => {
    try {
      const response = await apiClient.getJournal({ service, lines });
      setLogs((response.data as LogsApiResponse).logs || 'No logs available');
      setLoading(false);
    } catch (error) {
      toast.error(handleApiError(error));
      setLoading(false);
    }
  };

  const parseLogLine = (line: string) => {
    // Color code log levels
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Journal Logs</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={autoRefresh ? 'default' : 'outline'}>
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          <Select value={service} onValueChange={(v: any) => setService(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xray-report-ui">UI Service</SelectItem>
              <SelectItem value="xray">Xray Service</SelectItem>
            </SelectContent>
          </Select>

          <Select value={lines.toString()} onValueChange={(v) => setLines(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 lines</SelectItem>
              <SelectItem value="100">100 lines</SelectItem>
              <SelectItem value="200">200 lines</SelectItem>
              <SelectItem value="500">500 lines</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLogs()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant={autoRefresh ? 'destructive' : 'default'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Auto
              </>
            )}
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
