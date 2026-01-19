'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, RefreshCw, Archive } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';

export function BackupsSettings() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getBackups();
      setBackups(response.data.backups || []);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <CardLoadingSpinner />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {lang === 'ru' ? 'Бэкапы конфигурации' : 'Configuration Backups'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lang === 'ru'
                ? 'История изменений конфигурации Xray'
                : 'History of Xray configuration changes'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={loadBackups}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Обновить' : 'Refresh'}
          </Button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-12">
            <Archive className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {lang === 'ru' ? 'Нет бэкапов' : 'No backups found'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === 'ru' ? 'Дата' : 'Date'}</TableHead>
                <TableHead>{lang === 'ru' ? 'Тип' : 'Type'}</TableHead>
                <TableHead>{lang === 'ru' ? 'Размер' : 'Size'}</TableHead>
                <TableHead className="text-right">
                  {lang === 'ru' ? 'Действия' : 'Actions'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">
                    {formatDate(backup.timestamp || backup.date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {backup.type || backup.reason || 'config'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {backup.size ? formatSize(backup.size) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      <Download className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
