'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Users, Activity, TrendingUp, Zap } from 'lucide-react';
import { apiClient, handleApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import { motion } from 'framer-motion';

interface DashboardStats {
  users_total: number;
  users_active: number;
  traffic_total_bytes: number;
  traffic_prev_bytes: number;
  connections_total: number;
  connections_prev: number;
  avg_traffic_per_user: number;
  avg_traffic_prev: number;
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
      
      // Use getDashboard API (same as port 8787) - always works with 14 days for comparison
      const response = await apiClient.getDashboard({ days: 14 });
      const data = response.data as any;
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load dashboard data');
      }
      
      // Extract data from API response
      const globalData = data.global || {};
      const usersData = data.users || {};
      
      // Get traffic arrays
      const dailyTraffic = globalData.daily_traffic_bytes || [];
      const prevDailyTraffic = globalData.prev_daily_traffic_bytes || [];
      const dailyConns = globalData.daily_conns || [];
      const prevDailyConns = globalData.prev_daily_conns || [];
      
      // Calculate totals
      const traffic_total = dailyTraffic.reduce((sum: number, val: number) => sum + val, 0);
      const traffic_prev = prevDailyTraffic.reduce((sum: number, val: number) => sum + val, 0);
      const connections_total = dailyConns.reduce((sum: number, val: number) => sum + val, 0);
      const connections_prev = prevDailyConns.reduce((sum: number, val: number) => sum + val, 0);
      
      // Count users
      const users_total = Object.keys(usersData).length;
      const users_active = Object.values(usersData).filter(
        (u: any) => (u.daily_traffic_bytes || []).some((v: number) => v > 0)
      ).length;
      
      // Calculate average per user
      const avg_traffic = users_total > 0 ? traffic_total / users_total : 0;
      const avg_traffic_prev = users_total > 0 ? traffic_prev / users_total : 0;
      
      setStats({
        users_total,
        users_active,
        traffic_total_bytes: traffic_total,
        traffic_prev_bytes: traffic_prev,
        connections_total,
        connections_prev,
        avg_traffic_per_user: avg_traffic,
        avg_traffic_prev: avg_traffic_prev,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
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

  if (loading) {
    return (
      <div className="grid gap-2" style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))'
      }}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-2.5 min-h-[100px]">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <div className="h-3 w-16 bg-muted animate-pulse rounded"></div>
                <div className="h-6 w-12 bg-muted animate-pulse rounded"></div>
              </div>
              <div className="w-8 h-8 bg-muted animate-pulse rounded-full"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  // Calculate percentage changes
  const calculateChange = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const trafficChange = calculateChange(stats.traffic_total_bytes, stats.traffic_prev_bytes);
  const connsChange = calculateChange(stats.connections_total, stats.connections_prev);
  const avgTrafficChange = calculateChange(stats.avg_traffic_per_user, stats.avg_traffic_prev);

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
      value: formatBytes(stats.avg_traffic_per_user || 0),
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
      className="grid gap-2"
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))'
      }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {cards.map((card, index) => {
        const Icon = card.icon;
        const colors = colorClasses[card.color as keyof typeof colorClasses];

        return (
          <motion.div key={index} variants={cardVariants} className="container-metric">
            <Card className="p-2.5 min-h-[100px]">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] @[180px]:text-xs text-muted-foreground truncate">
                    {card.title}
                  </p>
                  <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                    <p className="text-xl @[180px]:text-2xl font-bold">
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
                    {/* Show change percentage */}
                    {card.change !== null && card.change !== undefined && (
                      <span className={`text-[10px] font-semibold ${
                        card.change > 0 ? 'text-green-600 dark:text-green-400' : 
                        card.change < 0 ? 'text-red-600 dark:text-red-400' : 
                        'text-gray-500'
                      }`}>
                        {card.change > 0 ? '↑' : card.change < 0 ? '↓' : '='}{Math.abs(card.change).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate hidden @[180px]:block">
                    {card.subtitle}
                  </p>
                </div>
                {/* Icon - hide on very small, show on larger */}
                <div className={`hidden @[200px]:flex w-8 h-8 @[220px]:w-10 @[220px]:h-10 ${colors.bg} rounded-full items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 @[220px]:w-5 @[220px]:h-5 ${colors.text}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
