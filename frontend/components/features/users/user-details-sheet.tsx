'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Activity, HardDrive, Calendar, Globe } from 'lucide-react';
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
      return `${mb.toFixed(1)} MB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <SheetHeader>
            <SheetTitle>{stats?.alias || user.email}</SheetTitle>
            <SheetDescription>
              {lang === 'ru' ? 'Детальная статистика пользователя' : 'User detailed statistics'}
            </SheetDescription>
          </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : stats ? (
          <div className="mt-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Badge variant={stats.isOnline ? 'default' : 'secondary'}>
                {stats.isOnline 
                  ? (lang === 'ru' ? 'Онлайн' : 'Online')
                  : (lang === 'ru' ? 'Офлайн' : 'Offline')}
              </Badge>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {lang === 'ru' ? 'Общий трафик' : 'Total Traffic'}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatBytes(stats.totalTrafficBytes || 0)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {lang === 'ru' ? 'Дней использования' : 'Days Used'}
                    </p>
                    <p className="text-2xl font-bold">
                      <NumberFlow 
                        value={stats.daysUsed || 0}
                        {...defaultNumberFlowConfig}
                      />
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Separator />

            {/* Top Domains */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {lang === 'ru' ? 'Топ-домены' : 'Top Domains'}
                </h3>
              </div>

              {stats.top3Domains && stats.top3Domains.length > 0 ? (
                <div className="space-y-2">
                  {stats.top3Domains.map((domain: any, idx: number) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm truncate">
                            {domain.domain}
                          </p>
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">
                          {formatBytes(domain.trafficBytes)}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lang === 'ru' ? 'Нет данных' : 'No data'}
                </p>
              )}
            </div>

            <Separator />

            {/* User Info */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                {lang === 'ru' ? 'Информация' : 'Information'}
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-mono">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UUID:</span>
                  <span className="font-mono text-xs">{user.uuid.slice(0, 8)}...</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            {lang === 'ru' ? 'Нет данных' : 'No data available'}
          </div>
        )}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
