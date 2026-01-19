'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Users, Activity, TrendingUp, Zap } from 'lucide-react';
import { apiClient, handleApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardStats {
  users_total: number;
  users_active: number;
  traffic_total_bytes: number;
  connections_total: number;
  prev_traffic_total_bytes: number;
  prev_connections_total: number;
}

interface MetricsCardsProps {
  selectedDate: string | null;
  mode: 'daily' | 'cumulative';
}

export function MetricsCards({ selectedDate, mode }: MetricsCardsProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadStats();
  }, [selectedDate, mode]);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Always use getUsageDashboard to support mode parameter
      let response;
      if (selectedDate) {
        // Historical data with selected date
        response = await apiClient.getUsageDashboard({
          date: selectedDate,
          mode,
          window_days: 7
        });
      } else {
        // Current data - use today's date
        const today = new Date().toISOString().split('T')[0];
        response = await apiClient.getUsageDashboard({
          date: today,
          mode,
          window_days: 7
        });
      }
      
      const data = response.data as any;
      
      // Calculate totals from Flask API format
      const dailyTraffic = data.global?.daily_traffic_bytes || [];
      const dailyConns = data.global?.daily_conns || [];
      const prevDailyTraffic = data.global?.prev_daily_traffic_bytes || [];
      const prevDailyConns = data.global?.prev_daily_conns || [];
      const users = data.users || {};
      
      const traffic_total = dailyTraffic.reduce((sum: number, val: number) => sum + val, 0);
      const connections_total = dailyConns.reduce((sum: number, val: number) => sum + val, 0);
      const prev_traffic_total = prevDailyTraffic.reduce((sum: number, val: number) => sum + val, 0);
      const prev_connections_total = prevDailyConns.reduce((sum: number, val: number) => sum + val, 0);
      
      const users_total = Object.keys(users).length;
      const users_active = Object.values(users).filter(
        (u: any) => (u.daily_traffic_bytes || []).some((v: number) => v > 0)
      ).length;
      
      setStats({
        users_total,
        users_active,
        traffic_total_bytes: traffic_total,
        connections_total,
        prev_traffic_total_bytes: prev_traffic_total,
        prev_connections_total: prev_connections_total,
      });
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const calculateChange = (current: number, previous: number): { percent: number; isPositive: boolean } => {
    if (previous === 0) {
      return { percent: current > 0 ? 100 : 0, isPositive: current > 0 };
    }
    const change = ((current - previous) / previous) * 100;
    return { percent: Math.abs(change), isPositive: change >= 0 };
  };

  if (loading) {
    return (
      <div className="grid gap-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-3 w-20 bg-muted animate-pulse rounded"></div>
                <div className="h-6 w-14 bg-muted animate-pulse rounded"></div>
              </div>
              <div className="w-10 h-10 bg-muted animate-pulse rounded-full"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const trafficChange = calculateChange(stats.traffic_total_bytes, stats.prev_traffic_total_bytes);
  const connsChange = calculateChange(stats.connections_total, stats.prev_connections_total);
  const avgTrafficCurrent = stats.users_total > 0 ? stats.traffic_total_bytes / stats.users_total : 0;
  const avgTrafficPrev = stats.users_total > 0 ? stats.prev_traffic_total_bytes / stats.users_total : 0;
  const avgTrafficChange = calculateChange(avgTrafficCurrent, avgTrafficPrev);

  const cards = [
    {
      title: lang === 'ru' ? 'Всего пользователей' : 'Total Users',
      value: stats.users_total || 0,
      subtitle: lang === 'ru' 
        ? `${stats.users_active || 0} активных` 
        : `${stats.users_active || 0} active`,
      icon: Users,
      color: 'blue',
      change: null,
    },
    {
      title: lang === 'ru' ? 'Трафик (7 дней)' : 'Traffic (7 days)',
      value: formatBytes(stats.traffic_total_bytes || 0),
      subtitle: lang === 'ru' ? 'Всего передано' : 'Total transferred',
      icon: TrendingUp,
      color: 'green',
      isNumber: false,
      change: trafficChange,
    },
    {
      title: lang === 'ru' ? 'Подключения' : 'Connections',
      value: stats.connections_total || 0,
      subtitle: lang === 'ru' ? 'За 7 дней' : 'Last 7 days',
      icon: Activity,
      color: 'purple',
      change: connsChange,
    },
    {
      title: lang === 'ru' ? 'Средний трафик' : 'Avg Traffic',
      value: stats.users_total > 0 
        ? formatBytes((stats.traffic_total_bytes || 0) / stats.users_total)
        : '0 B',
      subtitle: lang === 'ru' ? 'На пользователя' : 'Per user',
      icon: Zap,
      color: 'orange',
      isNumber: false,
      change: avgTrafficChange,
    },
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/20',
      text: 'text-blue-600',
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/20',
      text: 'text-green-600',
    },
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/20',
      text: 'text-purple-600',
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-900/20',
      text: 'text-orange-600',
    },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' as const }
    }
  };

  return (
    <motion.div
      className="grid gap-2 md:grid-cols-2 lg:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {cards.map((card, index) => {
        const Icon = card.icon;
        const colors = colorClasses[card.color as keyof typeof colorClasses];

        return (
          <motion.div key={index} variants={cardVariants}>
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {card.title}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <p className="text-2xl font-bold">
                      {card.isNumber === false ? (
                        card.value
                      ) : (
                        <NumberFlow 
                          value={card.value as number}
                          {...defaultNumberFlowConfig}
                          willChange
                        />
                      )}
                    </p>
                    {card.change && (
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={card.change.isPositive ? 'up' : 'down'}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                            card.change.isPositive 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {card.change.isPositive ? '↑' : '↓'} {card.change.percent.toFixed(1)}%
                        </motion.span>
                      </AnimatePresence>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {card.subtitle}
                  </p>
                </div>
                <div className={`w-10 h-10 ${colors.bg} rounded-full flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
