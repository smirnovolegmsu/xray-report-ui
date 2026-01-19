'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { apiClient, handleApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import type { DashboardApiResponse } from '@/types';

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
      const response = await apiClient.getDashboard({ days: 14 });
      const data = response.data as DashboardApiResponse;
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load dashboard data');
      }
      
      const globalData = data.global || {};
      const usersData = data.users || {};
      
      const dailyTraffic = globalData.daily_traffic_bytes || [];
      const prevDailyTraffic = globalData.prev_daily_traffic_bytes || [];
      const dailyConns = globalData.daily_conns || [];
      const prevDailyConns = globalData.prev_daily_conns || [];
      
      const traffic_total = dailyTraffic.reduce((sum: number, val: number) => sum + val, 0);
      const traffic_prev = prevDailyTraffic.reduce((sum: number, val: number) => sum + val, 0);
      const connections_total = dailyConns.reduce((sum: number, val: number) => sum + val, 0);
      const connections_prev = prevDailyConns.reduce((sum: number, val: number) => sum + val, 0);
      
      const users_total = Object.keys(usersData).length;
      const users_active = Object.values(usersData).filter(
        (u) => (u?.daily_traffic_bytes || []).some((v: number) => v > 0)
      ).length;
      
      // Считаем активных пользователей за каждый период
      // Активный = был трафик > 0
      const users_active_current = Object.values(usersData).filter(
        (u: any) => (u?.sum7_traffic_bytes || 0) > 0
      ).length;
      
      const users_active_prev = Object.values(usersData).filter(
        (u: any) => (u?.sum_prev7_traffic_bytes || 0) > 0
      ).length;
      
      // Средний трафик на активного пользователя в день
      // = Общий трафик / (активных пользователей × 7 дней)
      const avg_traffic = users_active_current > 0 
        ? traffic_total / (users_active_current * 7) 
        : 0;
      const avg_traffic_prev = users_active_prev > 0 
        ? traffic_prev / (users_active_prev * 7) 
        : 0;
      
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
    if (bytes === 0) return { value: '0', unit: 'B' };
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const numValue = bytes / Math.pow(k, i);
    // Округляем до одного знака после точки
    const value = numValue.toFixed(1);
    // Убираем лишний ноль если он есть (например, 81.5 вместо 81.50)
    const cleanValue = parseFloat(value).toString();
    return { value: cleanValue, unit: sizes[i] };
  };

  const calculateChange = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const formatChange = (change: number): string => {
    const absChange = Math.abs(change);
    if (absChange >= 10) {
      return Math.round(absChange).toString();
    }
    return absChange.toFixed(1);
  };

  // Card dimensions: 200px width, 115px height, 8px gap
  // Two cards = 408px width, 238px height
  
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 w-fit">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-3 w-[200px] h-[115px]">
            <div className="animate-pulse space-y-2">
              <div className="h-6 w-6 bg-muted rounded-md"></div>
              <div className="h-3 w-24 bg-muted rounded"></div>
              <div className="h-6 w-14 bg-muted rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const trafficChange = calculateChange(stats.traffic_total_bytes, stats.traffic_prev_bytes);
  const connsChange = calculateChange(stats.connections_total, stats.connections_prev);
  const avgTrafficChange = calculateChange(stats.avg_traffic_per_user, stats.avg_traffic_prev);

  const trafficFormatted = formatBytes(stats.traffic_total_bytes);
  const avgTrafficFormatted = formatBytes(stats.avg_traffic_per_user);

  const cards = [
    {
      title: lang === 'ru' ? 'Всего пользователей' : 'Total Users',
      value: stats.users_total,
      subtitle: lang === 'ru' 
        ? `${stats.users_active} активных` 
        : `${stats.users_active} active`,
      icon: Users,
      color: 'blue',
      change: null,
      isNumber: true,
    },
    {
      title: lang === 'ru' ? 'Трафик (7 дней)' : 'Traffic (7 days)',
      value: trafficFormatted.value,
      unit: trafficFormatted.unit,
      subtitle: lang === 'ru' ? 'Всего передано' : 'Total transferred',
      icon: TrendingUp,
      color: 'green',
      change: trafficChange,
      isNumber: false,
    },
    {
      title: lang === 'ru' ? 'Подключения' : 'Connections',
      value: stats.connections_total,
      subtitle: lang === 'ru' ? 'За 7 дней' : 'Last 7 days',
      icon: Activity,
      color: 'purple',
      change: connsChange,
      isNumber: true,
    },
    {
      title: lang === 'ru' ? 'Средний трафик' : 'Avg Traffic',
      value: avgTrafficFormatted.value,
      unit: avgTrafficFormatted.unit,
      subtitle: lang === 'ru' ? 'На чел./день' : 'Per user/day',
      icon: Zap,
      color: 'orange',
      change: avgTrafficChange,
      isNumber: false,
    },
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-600 dark:text-green-400',
    },
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-600 dark:text-purple-400',
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-600 dark:text-orange-400',
    },
  };

  return (
    <div className="grid grid-cols-2 gap-2 w-fit">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const colors = colorClasses[card.color as keyof typeof colorClasses];

        return (
          <Card key={index} className="p-3 w-[200px] h-[115px] grid grid-rows-[28px_32px_20px] hover:shadow-md transition-all duration-200">
            {/* Row 1: Title + Icon - fixed 28px */}
            <div className="flex items-start justify-between">
              <p className="text-[11px] text-muted-foreground leading-tight flex-1 pr-2">
                {card.title}
              </p>
              <div className={`w-7 h-7 ${colors.bg} rounded-md flex items-center justify-center shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
              </div>
            </div>
            
            {/* Row 2: Value - fixed 32px */}
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold leading-none">
                {card.isNumber ? (
                  <NumberFlow 
                    value={card.value as number}
                    format={{ 
                      style: 'decimal', 
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                      useGrouping: true
                    }}
                    {...defaultNumberFlowConfig}
                  />
                ) : (
                  card.value
                )}
              </span>
              {!card.isNumber && card.unit && (
                <span className="text-base font-medium text-muted-foreground">{card.unit}</span>
              )}
            </div>
            
            {/* Row 3: Footer - fixed 20px */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground truncate flex-1 mr-1">
                {card.subtitle}
              </p>
              {card.change !== null && (
                <Badge 
                  variant="outline"
                  className={`h-4 px-1 text-[10px] font-semibold shrink-0 flex items-center gap-0.5 ${
                    card.change > 0 
                      ? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400' 
                      : card.change < 0
                      ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'border-gray-500/50 bg-gray-500/10 text-gray-600'
                  }`}
                >
                  {card.change > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {formatChange(card.change)}%
                </Badge>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
