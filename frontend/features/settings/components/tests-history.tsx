'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { TestHistoryEntry, TestHistoryStats } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function TestsHistory() {
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [stats, setStats] = useState<TestHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [historyRes, statsRes] = await Promise.all([
        apiClient.getTestsHistory(100),
        apiClient.getTestsHistoryStats()
      ]);
      
      // Backend returns {ok: true, data: {history: ..., stats: ..., total: ...}}
      if (historyRes.data.ok && historyRes.data.data) {
        setHistory(historyRes.data.data.history || []);
        // Stats are also in history response
        if (historyRes.data.data.stats) {
          setStats(historyRes.data.data.stats);
        }
      }
      // Also try separate stats endpoint
      if (statsRes.data.ok && statsRes.data.data) {
        // Backend returns {ok: true, data: {total_runs: ..., ...}}
        setStats(statsRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load test history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString('ru-RU');
  };

  const getStatusBadge = (success: boolean) => {
    return success ? (
      <Badge variant="default" className="bg-green-500">Успешно</Badge>
    ) : (
      <Badge variant="destructive">Ошибка</Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Статистика тестов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold">{stats.total_runs}</div>
                <div className="text-sm text-muted-foreground">Всего запусков</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.successful_runs}</div>
                <div className="text-sm text-muted-foreground">Успешных</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.failed_runs}</div>
                <div className="text-sm text-muted-foreground">Неудачных</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.success_rate}%</div>
                <div className="text-sm text-muted-foreground">Успешность</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>История запусков тестов</CardTitle>
          <CardDescription>Последние 100 запусков</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              История тестов пуста. Запустите тесты, чтобы увидеть результаты.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата/Время</TableHead>
                  <TableHead>Что тестировалось</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Результат</TableHead>
                  <TableHead>Пройдено</TableHead>
                  <TableHead>Провалено</TableHead>
                  <TableHead>Всего</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatTimestamp(entry.timestamp)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.tested_item}</div>
                        {entry.what_tested && (
                          <div className="text-sm text-muted-foreground">{entry.what_tested}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.tested_type}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.success)}</TableCell>
                    <TableCell className="text-green-600">{entry.response.passed}</TableCell>
                    <TableCell className="text-red-600">{entry.response.failed}</TableCell>
                    <TableCell>{entry.response.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
