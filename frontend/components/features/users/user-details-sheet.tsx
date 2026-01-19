'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { 
  HardDrive, 
  Calendar, 
  Globe, 
  Clock, 
  User, 
  CalendarDays,
  CalendarClock,
  Timer
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import { motion } from 'framer-motion';

interface UserDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    uuid: string;
    email: string;
    alias?: string;
  };
}

export function UserDetailsSheet({
  open,
  onOpenChange,
  user,
}: UserDetailsSheetProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    if (open) {
      loadStats();
    }
  }, [open, user.uuid]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUserStats(user.uuid);
      const userData = response.data.users?.find((u: any) => u.email === user.email);
      setStats(userData || null);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb < 1) {
      const mb = bytes / 1024 / 1024;
      return `${Math.round(mb)} MB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysSince = (dateStr: string | undefined): number => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const formatDaysSince = (days: number): string => {
    if (days === 0) return lang === 'ru' ? 'Сегодня' : 'Today';
    if (days === 1) return lang === 'ru' ? '1 день' : '1 day';
    if (lang === 'ru') {
      if (days >= 11 && days <= 14) return `${days} дней`;
      const lastDigit = days % 10;
      if (lastDigit === 1) return `${days} день`;
      if (lastDigit >= 2 && lastDigit <= 4) return `${days} дня`;
      return `${days} дней`;
    }
    return `${days} days`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto p-0">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex flex-col h-full"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b bg-muted/30">
            <SheetHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <SheetTitle className="text-lg leading-tight">
                      {stats?.alias || user.email.split('@')[0]}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground font-mono">
                      {user.email}
                    </p>
                  </div>
                </div>
                {stats && (
                  <Badge 
                    variant={stats.isOnline ? 'default' : 'secondary'}
                    className={stats.isOnline ? 'bg-green-600' : ''}
                  >
                    <div className={`w-2 h-2 rounded-full mr-1.5 ${stats.isOnline ? 'bg-white' : 'bg-muted-foreground'}`} />
                    {stats.isOnline 
                      ? (lang === 'ru' ? 'Онлайн' : 'Online')
                      : (lang === 'ru' ? 'Офлайн' : 'Offline')}
                  </Badge>
                )}
              </div>
            </SheetHeader>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : stats ? (
            <div className="flex-1 overflow-y-auto">
              {/* Connection Dates Section */}
              <div className="p-6 space-y-4 border-b">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {lang === 'ru' ? 'Подключения' : 'Connections'}
                </h3>
                
                <div className="grid gap-3">
                  {/* First Connection */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {lang === 'ru' ? 'Первое подключение' : 'First Connection'}
                      </p>
                      <p className="text-sm font-medium truncate">
                        {formatDate(stats.firstSeenAt)}
                      </p>
                    </div>
                  </div>

                  {/* Last Connection */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <CalendarClock className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {lang === 'ru' ? 'Последнее подключение' : 'Last Connection'}
                      </p>
                      <p className="text-sm font-medium truncate">
                        {formatDate(stats.lastSeenAt)}
                      </p>
                    </div>
                  </div>

                  {/* Days Since Last Connection */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Timer className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {lang === 'ru' ? 'С последнего подключения' : 'Since Last Connection'}
                      </p>
                      <p className="text-sm font-medium">
                        {stats.lastSeenAt ? formatDaysSince(getDaysSince(stats.lastSeenAt)) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Traffic Stats Section */}
              <div className="p-6 space-y-4 border-b">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {lang === 'ru' ? 'Статистика' : 'Statistics'}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Total Traffic */}
                  <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-blue-500" />
                      <span className="text-xs text-muted-foreground">
                        {lang === 'ru' ? 'Трафик' : 'Traffic'}
                      </span>
                    </div>
                    <p className="text-xl font-bold">
                      {formatBytes(stats.totalTrafficBytes || 0)}
                    </p>
                  </div>

                  {/* Days Used */}
                  <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-muted-foreground">
                        {lang === 'ru' ? 'Дней' : 'Days'}
                      </span>
                    </div>
                    <p className="text-xl font-bold">
                      <NumberFlow 
                        value={stats.daysUsed || 0}
                        {...defaultNumberFlowConfig}
                      />
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Domains Section */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {lang === 'ru' ? 'Топ домены' : 'Top Domains'}
                  </h3>
                </div>

                {stats.top3Domains && stats.top3Domains.length > 0 ? (
                  <div className="space-y-2">
                    {stats.top3Domains.map((domain: any, idx: number) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                            {idx + 1}
                          </div>
                          <span className="font-mono text-sm truncate" title={domain.domain}>
                            {domain.domain}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground shrink-0">
                          {formatBytes(domain.trafficBytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {lang === 'ru' ? 'Нет данных о доменах' : 'No domain data'}
                  </p>
                )}
              </div>

              {/* User Info Footer */}
              <div className="p-6 pt-0">
                <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                  <div className="flex justify-between mb-1">
                    <span>UUID:</span>
                    <span className="font-mono">{user.uuid.slice(0, 12)}...</span>
                  </div>
                  {stats.alias && (
                    <div className="flex justify-between">
                      <span>{lang === 'ru' ? 'Псевдоним:' : 'Alias:'}</span>
                      <span>{stats.alias}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground">
              {lang === 'ru' ? 'Нет данных' : 'No data available'}
            </div>
          )}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
