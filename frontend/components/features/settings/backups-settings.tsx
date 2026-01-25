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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { 
  Download, 
  RefreshCw, 
  Archive, 
  ChevronDown, 
  ChevronRight, 
  Users, 
  Server, 
  Network,
  User,
  FileJson,
  Plus,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';
import type { Backup, BackupPreview, BackupDetail, BackupRestorePreview } from '@/types';

interface BackupWithPreview extends Backup {
  preview?: BackupPreview;
  detail?: BackupDetail;
  loadingPreview?: boolean;
  loadingDetail?: boolean;
}

export function BackupsSettings() {
  const [backups, setBackups] = useState<BackupWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [viewDialog, setViewDialog] = useState<{ open: boolean; content: any; filename: string }>({
    open: false,
    content: null,
    filename: '',
  });
  const [creating, setCreating] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    filename: string;
    preview: BackupRestorePreview | null;
    loading: boolean;
    restoring: boolean;
  }>({
    open: false,
    filename: '',
    preview: null,
    loading: false,
    restoring: false,
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    filename: string;
    loading: boolean;
  }>({
    open: false,
    filename: '',
    loading: false,
  });
  const { lang } = useAppStore();

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getBackups();
      const backupsData = response.data.backups || [];
      setBackups(backupsData.map(b => ({ 
        ...b, 
        preview: undefined, 
        detail: undefined,
        loadingPreview: false,
        loadingDetail: false,
      })));
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async (backup: BackupWithPreview, index: number) => {
    if (backup.preview || backup.loadingPreview) return;
    
    setBackups(prev => prev.map((b, i) => 
      i === index ? { ...b, loadingPreview: true } : b
    ));

    try {
      const response = await apiClient.getBackupPreview(backup.name);
      setBackups(prev => prev.map((b, i) => 
        i === index ? { ...b, preview: response.data, loadingPreview: false } : b
      ));
    } catch (error) {
      toast.error(handleApiError(error));
      setBackups(prev => prev.map((b, i) => 
        i === index ? { ...b, loadingPreview: false } : b
      ));
    }
  };

  const loadDetail = async (backup: BackupWithPreview, index: number) => {
    if (backup.detail || backup.loadingDetail) return;
    
    setBackups(prev => prev.map((b, i) => 
      i === index ? { ...b, loadingDetail: true } : b
    ));

    try {
      const response = await apiClient.getBackupDetail(backup.name);
      setBackups(prev => prev.map((b, i) => 
        i === index ? { ...b, detail: response.data, loadingDetail: false } : b
      ));
    } catch (error) {
      toast.error(handleApiError(error));
      setBackups(prev => prev.map((b, i) => 
        i === index ? { ...b, loadingDetail: false } : b
      ));
    }
  };

  const toggleRow = (index: number) => {
    const backup = backups[index];
    
    if (!backup.preview && !backup.loadingPreview) {
      loadPreview(backup, index);
    }
    
    const willExpand = !expandedRows.has(index);
    if (willExpand && !backup.detail && !backup.loadingDetail) {
      loadDetail(backup, index);
    }
    
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleViewFull = async (filename: string) => {
    try {
      const response = await apiClient.getBackupContent(filename);
      setViewDialog({
        open: true,
        content: response.data.content,
        filename,
      });
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const response = await apiClient.createBackup();
      toast.success(
        lang === 'ru' 
          ? `Бэкап создан: ${response.data.backup.name}` 
          : `Backup created: ${response.data.backup.name}`
      );
      loadBackups();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreClick = async (filename: string) => {
    setRestoreDialog({
      open: true,
      filename,
      preview: null,
      loading: true,
      restoring: false,
    });

    try {
      const response = await apiClient.restoreBackup(filename, false);
      if ('preview' in response.data) {
        setRestoreDialog(prev => ({
          ...prev,
          preview: response.data as BackupRestorePreview,
          loading: false,
        }));
      }
    } catch (error) {
      toast.error(handleApiError(error));
      setRestoreDialog(prev => ({ ...prev, open: false }));
    }
  };

  const handleRestoreConfirm = async () => {
    setRestoreDialog(prev => ({ ...prev, restoring: true }));

    try {
      const response = await apiClient.restoreBackup(restoreDialog.filename, true, true);
      if ('restored' in response.data && response.data.restored) {
        toast.success(
          lang === 'ru' 
            ? 'Конфигурация успешно восстановлена' 
            : 'Configuration restored successfully'
        );
        setRestoreDialog(prev => ({ ...prev, open: false }));
        loadBackups();
      }
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setRestoreDialog(prev => ({ ...prev, restoring: false }));
    }
  };

  const handleDeleteClick = (filename: string) => {
    setDeleteDialog({
      open: true,
      filename,
      loading: false,
    });
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialog(prev => ({ ...prev, loading: true }));

    try {
      await apiClient.deleteBackup(deleteDialog.filename);
      toast.success(
        lang === 'ru' 
          ? 'Бэкап удален' 
          : 'Backup deleted'
      );
      setDeleteDialog(prev => ({ ...prev, open: false }));
      loadBackups();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setDeleteDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return lang === 'ru' ? 'Неизвестно' : 'Unknown';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return lang === 'ru' ? 'Неверная дата' : 'Invalid Date';
      }
      return date.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
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

  const handleDownload = async (filename: string) => {
    try {
      const response = await apiClient.downloadBackup(filename);
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(lang === 'ru' ? 'Бэкап скачан' : 'Backup downloaded');
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
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-semibold">
                {lang === 'ru' ? 'Бэкапы конфигурации' : 'Configuration Backups'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {lang === 'ru'
                  ? 'Управление бэкапами конфигурации Xray. Бэкапы создаются автоматически при изменениях.'
                  : 'Manage Xray configuration backups. Backups are created automatically on changes.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={handleCreateBackup}
                disabled={creating}
              >
                <Plus className="w-4 h-4 mr-2" />
                {creating 
                  ? (lang === 'ru' ? 'Создание...' : 'Creating...')
                  : (lang === 'ru' ? 'Создать бэкап' : 'Create Backup')}
              </Button>
              <Button size="sm" variant="outline" onClick={loadBackups}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Обновить' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Info card */}
          <Card className="p-3 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-500">
                {lang === 'ru'
                  ? 'Бэкапы создаются автоматически при добавлении/удалении пользователей и изменении настроек Xray.'
                  : 'Backups are created automatically when adding/removing users and changing Xray settings.'}
              </p>
            </div>
          </Card>

          {backups.length === 0 ? (
            <EmptyState
              icon={Archive}
              title={lang === 'ru' ? 'Нет бэкапов' : 'No backups found'}
              description={lang === 'ru' 
                ? 'Создайте первый бэкап вручную или дождитесь автоматического создания при изменениях'
                : 'Create your first backup manually or wait for automatic creation on changes'}
              action={
                <Button onClick={handleCreateBackup} disabled={creating}>
                  <Plus className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Создать бэкап' : 'Create Backup'}
                </Button>
              }
            />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-[180px]">{lang === 'ru' ? 'Дата' : 'Date'}</TableHead>
                    <TableHead className="min-w-[200px]">{lang === 'ru' ? 'Превью' : 'Preview'}</TableHead>
                    <TableHead className="w-[100px]">{lang === 'ru' ? 'Размер' : 'Size'}</TableHead>
                    <TableHead className="w-[180px] text-right">
                      {lang === 'ru' ? 'Действия' : 'Actions'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup, idx) => {
                    const isExpanded = expandedRows.has(idx);
                    const preview = backup.preview;
                    const detail = backup.detail;
                    
                    return (
                      <Collapsible
                        key={idx}
                        open={isExpanded}
                        onOpenChange={() => toggleRow(idx)}
                      >
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatDate(backup.mtime)}
                            </TableCell>
                            <TableCell>
                              {backup.loadingPreview ? (
                                <span className="text-xs text-muted-foreground">
                                  {lang === 'ru' ? 'Загрузка...' : 'Loading...'}
                                </span>
                              ) : preview ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="secondary" className="text-xs">
                                    <Users className="w-3 h-3 mr-1" />
                                    {preview.users_count}
                                  </Badge>
                                  {preview.ports.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      <Server className="w-3 h-3 mr-1" />
                                      {preview.ports.join(', ')}
                                    </Badge>
                                  )}
                                  {preview.protocols.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      <Network className="w-3 h-3 mr-1" />
                                      {preview.protocols.join(', ')}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {lang === 'ru' ? 'Нажмите для загрузки' : 'Click to load'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {backup.size ? formatSize(backup.size) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreClick(backup.name);
                                  }}
                                  title={lang === 'ru' ? 'Восстановить' : 'Restore'}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewFull(backup.name);
                                  }}
                                  title={lang === 'ru' ? 'Просмотр JSON' : 'View JSON'}
                                >
                                  <FileJson className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(backup.name);
                                  }}
                                  title={lang === 'ru' ? 'Скачать' : 'Download'}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(backup.name);
                                  }}
                                  title={lang === 'ru' ? 'Удалить' : 'Delete'}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={5} className="p-0 bg-muted/20">
                                {backup.loadingDetail ? (
                                  <div className="p-8 text-center">
                                    <CardLoadingSpinner />
                                  </div>
                                ) : detail ? (
                                  <div className="p-6 space-y-6">
                                    {/* Statistics */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      <Card className="p-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-primary" />
                                          </div>
                                          <div>
                                            <div className="text-xs font-medium text-muted-foreground">
                                              {lang === 'ru' ? 'Пользователей' : 'Users'}
                                            </div>
                                            <div className="text-2xl font-bold">
                                              {detail.users.length}
                                            </div>
                                          </div>
                                        </div>
                                      </Card>
                                      <Card className="p-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                            <Network className="w-5 h-5 text-blue-500" />
                                          </div>
                                          <div>
                                            <div className="text-xs font-medium text-muted-foreground">
                                              {lang === 'ru' ? 'Инбаундов' : 'Inbounds'}
                                            </div>
                                            <div className="text-2xl font-bold">
                                              {detail.inbounds.length}
                                            </div>
                                          </div>
                                        </div>
                                      </Card>
                                      <Card className="p-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                            <Server className="w-5 h-5 text-green-500" />
                                          </div>
                                          <div>
                                            <div className="text-xs font-medium text-muted-foreground">
                                              {lang === 'ru' ? 'Портов' : 'Ports'}
                                            </div>
                                            <div className="text-lg font-bold">
                                              {detail.ports.join(', ') || '—'}
                                            </div>
                                          </div>
                                        </div>
                                      </Card>
                                      <Card className="p-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                            <Network className="w-5 h-5 text-purple-500" />
                                          </div>
                                          <div>
                                            <div className="text-xs font-medium text-muted-foreground">
                                              {lang === 'ru' ? 'Протоколы' : 'Protocols'}
                                            </div>
                                            <div className="text-sm font-bold">
                                              {detail.protocols.join(', ') || '—'}
                                            </div>
                                          </div>
                                        </div>
                                      </Card>
                                    </div>

                                    {/* Users list */}
                                    {detail.users.length > 0 && (
                                      <div className="space-y-3">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                          <Users className="w-4 h-4" />
                                          {lang === 'ru' ? 'Пользователи' : 'Users'} ({detail.users.length})
                                        </h4>
                                        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                          {detail.users.slice(0, 9).map((user, i) => (
                                            <Card key={i} className="p-3">
                                              <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                  <User className="w-4 h-4 text-primary" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <div className="font-medium text-sm truncate">
                                                    {user.alias || user.email.split('@')[0]}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground font-mono truncate">
                                                    {user.email}
                                                  </div>
                                                </div>
                                              </div>
                                            </Card>
                                          ))}
                                          {detail.users.length > 9 && (
                                            <Card className="p-3 flex items-center justify-center text-sm text-muted-foreground">
                                              +{detail.users.length - 9} {lang === 'ru' ? 'ещё' : 'more'}
                                            </Card>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-4 border-t">
                                      <Button
                                        size="sm"
                                        onClick={() => handleRestoreClick(backup.name)}
                                      >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        {lang === 'ru' ? 'Восстановить' : 'Restore'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleViewFull(backup.name)}
                                      >
                                        <FileJson className="w-4 h-4 mr-2" />
                                        {lang === 'ru' ? 'Просмотр JSON' : 'View JSON'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDownload(backup.name)}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        {lang === 'ru' ? 'Скачать' : 'Download'}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-8 text-center text-sm text-muted-foreground">
                                    {lang === 'ru' ? 'Нажмите на строку для загрузки деталей' : 'Click row to load details'}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Total count */}
          {backups.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {lang === 'ru' ? `Всего бэкапов: ${backups.length}` : `Total backups: ${backups.length}`}
            </p>
          )}
        </div>
      </Card>

      {/* View JSON Dialog */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ ...viewDialog, open })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              {lang === 'ru' ? 'JSON конфигурации' : 'Configuration JSON'}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {viewDialog.filename}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono max-h-[60vh]">
              {JSON.stringify(viewDialog.content, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={restoreDialog.open}
        onOpenChange={(open) => setRestoreDialog(prev => ({ ...prev, open }))}
        title={lang === 'ru' ? 'Восстановить бэкап?' : 'Restore backup?'}
        description={lang === 'ru' 
          ? 'Текущая конфигурация будет заменена. Перед восстановлением будет создан бэкап текущего состояния.'
          : 'Current configuration will be replaced. A backup of current state will be created before restore.'}
        variant="warning"
        confirmText={lang === 'ru' ? 'Восстановить' : 'Restore'}
        onConfirm={handleRestoreConfirm}
        loading={restoreDialog.restoring}
      >
        {restoreDialog.loading ? (
          <div className="flex items-center justify-center py-4">
            <CardLoadingSpinner />
          </div>
        ) : restoreDialog.preview && (
          <div className="space-y-3">
            <Card className="p-3 bg-yellow-500/10 border-yellow-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  {restoreDialog.preview.warning}
                </p>
              </div>
            </Card>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">{lang === 'ru' ? 'Текущее' : 'Current'}</h4>
                <p className="text-muted-foreground">
                  {lang === 'ru' ? 'Пользователей:' : 'Users:'} {restoreDialog.preview.current.users_count}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">{lang === 'ru' ? 'Из бэкапа' : 'From backup'}</h4>
                <p className="text-muted-foreground">
                  {lang === 'ru' ? 'Пользователей:' : 'Users:'} {restoreDialog.preview.backup.users_count}
                </p>
                <p className="text-muted-foreground">
                  {lang === 'ru' ? 'Инбаундов:' : 'Inbounds:'} {restoreDialog.preview.backup.inbounds_count}
                </p>
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title={lang === 'ru' ? 'Удалить бэкап?' : 'Delete backup?'}
        description={lang === 'ru' 
          ? `Вы уверены, что хотите удалить бэкап "${deleteDialog.filename}"? Это действие нельзя отменить.`
          : `Are you sure you want to delete backup "${deleteDialog.filename}"? This action cannot be undone.`}
        variant="destructive"
        confirmText={lang === 'ru' ? 'Удалить' : 'Delete'}
        onConfirm={handleDeleteConfirm}
        loading={deleteDialog.loading}
      />
    </>
  );
}
