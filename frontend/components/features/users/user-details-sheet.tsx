'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  HardDrive,
  Calendar,
  Globe,
  User,
  CalendarDays,
  CalendarClock,
  Timer,
  Smartphone,
  Network,
  AlertTriangle,
  Wifi,
  MapPin,
  Activity,
  Zap,
  TrendingUp,
  Link as LinkIcon,
  Edit,
  Power,
  Trash2,
  Video,
  MessageCircle,
  Share2,
  Cpu,
  FileText,
  Clock,
  Users,
  AlertCircle,
} from 'lucide-react';
import type { UserDevicesInfo, UserAnalyticsResponse, TrafficCalendarResponse, IpHistoryResponse, DisconnectDaysResponse } from '@/types';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError, formatBytes } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import { motion } from 'framer-motion';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface UserDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    uuid: string;
    email: string;
    alias?: string;
  };
}

const getDomainIcon = (domain: string) => {
  const d = domain.toLowerCase();
  if (d.includes('youtube') || d.includes('youtu.be') || d.includes('netflix') || d.includes('vimeo')) {
    return <Video className="w-3.5 h-3.5 text-red-500" />;
  }
  if (d.includes('telegram') || d.includes('whatsapp') || d.includes('viber') || d.includes('discord')) {
    return <MessageCircle className="w-3.5 h-3.5 text-blue-500" />;
  }
  if (d.includes('facebook') || d.includes('instagram') || d.includes('twitter') || d.includes('tiktok')) {
    return <Share2 className="w-3.5 h-3.5 text-purple-500" />;
  }
  if (d.includes('anthropic') || d.includes('openai') || d.includes('claude') || d.includes('cursor')) {
    return <Cpu className="w-3.5 h-3.5 text-violet-500" />;
  }
  return <Globe className="w-3.5 h-3.5 text-muted-foreground" />;
};

const categoryIcons: Record<string, { icon: React.ReactNode; color: string; label: { ru: string; en: string } }> = {
  video: { icon: <Video className="w-4 h-4" />, color: 'text-red-500', label: { ru: 'Видео', en: 'Video' } },
  messengers: { icon: <MessageCircle className="w-4 h-4" />, color: 'text-blue-500', label: { ru: 'Мессенджеры', en: 'Messengers' } },
  social: { icon: <Share2 className="w-4 h-4" />, color: 'text-purple-500', label: { ru: 'Соцсети', en: 'Social' } },
  ai: { icon: <Cpu className="w-4 h-4" />, color: 'text-violet-500', label: { ru: 'AI', en: 'AI' } },
  google: { icon: <Globe className="w-4 h-4" />, color: 'text-yellow-500', label: { ru: 'Google', en: 'Google' } },
  apple: { icon: <Globe className="w-4 h-4" />, color: 'text-gray-500', label: { ru: 'Apple', en: 'Apple' } },
  other: { icon: <FileText className="w-4 h-4" />, color: 'text-muted-foreground', label: { ru: 'Другое', en: 'Other' } },
};

// Mini sparkline component
function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - (value / max) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 20" className={`w-16 h-4 ${className}`} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserDetailsSheet({
  open,
  onOpenChange,
  user,
}: UserDetailsSheetProps) {
  const [stats, setStats] = useState<any>(null);
  const [deviceInfo, setDeviceInfo] = useState<UserDevicesInfo | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalyticsResponse | null>(null);
  const [calendarData, setCalendarData] = useState<TrafficCalendarResponse | null>(null);
  const [disconnectDays, setDisconnectDays] = useState<DisconnectDaysResponse | null>(null);
  const [ipHistories, setIpHistories] = useState<Map<string, IpHistoryResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    if (open) {
      loadStats();
    } else {
      // Clean up state when sheet closes to prevent data leakage
      setStats(null);
      setDeviceInfo(null);
      setAnalytics(null);
      setCalendarData(null);
      setDisconnectDays(null);
      setIpHistories(new Map());
      setLoading(true);
    }
  }, [open, user.uuid]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [statsResponse, devicesResponse, analyticsResponse, calendarResponse, disconnectsResponse] = await Promise.all([
        apiClient.getUserStats(user.uuid),
        apiClient.getUserDevices(user.email),
        apiClient.getUserAnalytics(user.email, 30),
        apiClient.getTrafficCalendar(user.email, 2),
        apiClient.getDisconnectDays(user.email, 60),
      ]);

      const userData = statsResponse.data.users?.find((u: any) => u.email === user.email);
      setStats(userData || null);

      if (devicesResponse.data?.ok) {
        const userDeviceData = devicesResponse.data;
        setDeviceInfo(userDeviceData || null);

        // Load IP histories using BATCH endpoint
        if (userDeviceData && userDeviceData.devices) {
          const topIps = userDeviceData.devices
            .sort((a, b) => b.total_connections - a.total_connections)
            .slice(0, 10)
            .map(d => d.ip);

          if (topIps.length > 0) {
            try {
              const batchResponse = await apiClient.getIpHistoriesBatch(user.email, topIps, 60);
              if (batchResponse.data?.ok && batchResponse.data.histories) {
                const historyMap = new Map<string, IpHistoryResponse>();
                Object.entries(batchResponse.data.histories).forEach(([ip, data]) => {
                  historyMap.set(ip, data as IpHistoryResponse);
                });
                // 📊 Debug logging for IP histories
                let sharedCount = 0;
                let concurrentCount = 0;
                historyMap.forEach((data, ip) => {
                  if (data.shared_ip) sharedCount++;
                  if (data.other_users?.some((u: any) => u.concurrent)) concurrentCount++;
                });
                console.log('📊 IP Histories loaded:', {
                  total: historyMap.size,
                  shared: sharedCount,
                  concurrent: concurrentCount,
                  topIPs: topIps.slice(0, 5),
                });
                historyMap.forEach((data, ip) => {
                  if (data.shared_ip) {
                    console.log(`🔥 Shared IP ${ip}:`, {
                      otherUsers: data.other_users?.length,
                      concurrent: data.other_users?.filter((u: any) => u.concurrent).length,
                      last7Days: data.last_7_active_days?.length,
                    });
                  }
                });
                                setIpHistories(historyMap);
              } else {
                console.warn('IP histories batch returned non-ok response');
                setIpHistories(new Map());
              }
            } catch (e) {
              console.error('IP batch error:', e);
              setIpHistories(new Map()); // Set empty map on error
            }
          }
        }
      }

      if (analyticsResponse.data?.ok) {
        setAnalytics(analyticsResponse.data);
      }

      if (calendarResponse.data?.ok) {
        setCalendarData(calendarResponse.data);
      }

      if (disconnectsResponse.data?.ok) {
        setDisconnectDays(disconnectsResponse.data);
      }
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const formatDateTimeFull = (dateStr: string | undefined): string => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getDaysSince = (dateStr: string | undefined): number => {
    if (!dateStr) return 999;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return days;
  };

  const formatDaysSince = (days: number): string => {
    if (days < 0) return lang === 'ru' ? 'Сегодня' : 'Today';
    if (days === 0) return lang === 'ru' ? 'Сегодня' : 'Today';
    if (days === 1) return lang === 'ru' ? 'Вчера' : 'Yesterday';
    if (days >= 2 && days <= 6) return lang === 'ru' ? `${days} дня назад` : `${days} days ago`;
    if (days === 7) return lang === 'ru' ? 'Неделю назад' : 'A week ago';
    if (days > 7 && days < 30) return lang === 'ru' ? `${days} дней назад` : `${days} days ago`;
    if (days >= 30 && days < 60) return lang === 'ru' ? 'Месяц назад' : 'A month ago';
    const months = Math.floor(days / 30);
    if (months < 12) {
      if (lang === 'ru') {
        if (months === 1) return 'Месяц назад';
        if (months >= 2 && months <= 4) return `${months} месяца назад`;
        return `${months} месяцев назад`;
      }
      return `${months} months ago`;
    }
    const years = Math.floor(days / 365);
    if (lang === 'ru') {
      if (years === 1) return 'Год назад';
      if (years >= 2 && years <= 4) return `${years} года назад`;
      return `${years} лет назад`;
    }
    return years === 1 ? 'A year ago' : `${years} years ago`;
  };

  const formatTimestampFull = (ts: number): string => {
    const date = new Date(ts * 1000);
    return date.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}${lang === 'ru' ? 'с' : 's'}`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}${lang === 'ru' ? 'м' : 'm'}`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}${lang === 'ru' ? 'ч' : 'h'} ${minutes}${lang === 'ru' ? 'м' : 'm'}`;
  };


  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short'
    });
  };

  const handleGetLink = async () => {
    try {
      const response = await apiClient.getUserLink(user.uuid);
      const link = response.data.link;
      await navigator.clipboard.writeText(link);
      toast.success(lang === 'ru' ? 'Ссылка скопирована!' : 'Link copied!');
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };

  const renderCalendarHeatmap = () => {
    if (!calendarData || calendarData.calendar_data.length === 0) {
      return (
        <p className="text-xs text-muted-foreground py-3 text-center">
          {lang === 'ru' ? 'Нет данных' : 'No data'}
        </p>
      );
    }

    const trafficMap = new Map<string, number>();
    const disconnectMap = disconnectDays?.disconnect_days || {};
    let maxTraffic = 0;

    calendarData.calendar_data.forEach(day => {
      trafficMap.set(day.date, day.traffic_bytes);
      if (day.traffic_bytes > maxTraffic) {
        maxTraffic = day.traffic_bytes;
      }
    });

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const renderMonth = (monthStart: Date) => {
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth();
      const monthName = monthStart.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
        month: 'long',
        year: 'numeric'
      });

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay();
      const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

      const weeks: (string | null)[][] = [];
      let currentWeek: (string | null)[] = [];

      for (let i = 0; i < adjustedFirstDay; i++) {
        currentWeek.push(null);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        currentWeek.push(dateStr);

        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }

      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
      }

      const weekdayNames = lang === 'ru' ? ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

      return (
        <div key={month} className="space-y-1.5">
          <h4 className="text-[10px] font-medium text-muted-foreground">{monthName}</h4>
          <div className="space-y-0.5">
            <div className="grid grid-cols-7 gap-0.5">
              {weekdayNames.map((name, idx) => (
                <div key={idx} className="text-[9px] text-center text-muted-foreground">
                  {name}
                </div>
              ))}
            </div>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 gap-0.5">
                {week.map((dateStr, dayIdx) => {
                  if (!dateStr) {
                    return <div key={dayIdx} className="aspect-square" />;
                  }

                  const traffic = trafficMap.get(dateStr) || 0;
                  const disconnects = disconnectMap[dateStr] || 0;
                  const day = parseInt(dateStr.split('-')[2]);

                  let bgColor = 'bg-muted/50';
                  if (traffic > 0) {
                    const intensity = Math.min((traffic / maxTraffic) * 100, 100);
                    if (intensity >= 75) bgColor = 'bg-green-600';
                    else if (intensity >= 50) bgColor = 'bg-green-500';
                    else if (intensity >= 25) bgColor = 'bg-green-400';
                    else bgColor = 'bg-green-300';
                  }

                  return (
                    <div
                      key={dayIdx}
                      className={`relative aspect-square rounded text-[9px] flex items-center justify-center font-medium transition-all hover:scale-125 hover:z-10 cursor-help ${bgColor} ${
                        traffic > 0 ? 'text-white' : 'text-muted-foreground'
                      }`}
                      title={`${dateStr}\n${formatBytes(traffic) as string}${disconnects > 0 ? `\n⚠️ ${disconnects} ${lang === 'ru' ? 'разрывов' : 'disconnects'}` : ''}`}
                    >
                      {day}
                      {disconnects > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 border border-white" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3">
        {renderMonth(previousMonth)}
        {renderMonth(currentMonth)}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[620px] overflow-y-auto p-0">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col h-full"
        >
          {/* Ultra-Compact Header */}
          <div className="p-4 border-b bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-base leading-tight">
                    {stats?.alias || user.email.split('@')[0]}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {user.email}
                  </p>
                </div>
              </div>
              {stats && (
                <Badge
                  variant={stats.isOnline ? 'default' : 'secondary'}
                  className={`${stats.isOnline ? 'bg-green-600' : ''} text-xs h-6`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mr-1 ${stats.isOnline ? 'bg-white animate-pulse' : 'bg-muted-foreground'}`} />
                  {stats.isOnline ? (lang === 'ru' ? 'Онлайн' : 'Online') : (lang === 'ru' ? 'Офлайн' : 'Offline')}
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleGetLink}>
                <LinkIcon className="w-3 h-3 mr-1" />
                VLESS
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Edit className="w-3 h-3 mr-1" />
                {lang === 'ru' ? 'Имя' : 'Edit'}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Power className="w-3 h-3 mr-1" />
                Kick
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner size="md" fullScreen />
          ) : stats ? (
            <div className="flex-1 overflow-y-auto">
              {/* Combined: Connections + Stats - 2 Column Grid */}
              <div className="p-4 border-b">
                <div className="grid grid-cols-2 gap-3">
                  {/* Left Column - Connections */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {lang === 'ru' ? 'Подключения' : 'Connections'}
                    </h3>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'Первое' : 'First'}</p>
                          <p className="text-[10px] font-medium truncate">{formatDateTimeFull(stats.firstSeenAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <CalendarClock className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'Последнее' : 'Last'}</p>
                          <p className="text-[10px] font-medium truncate">{formatDateTimeFull(stats.lastSeenAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <Timer className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'С последнего' : 'Since'}</p>
                          <p className="text-[10px] font-medium">{stats.lastSeenAt ? formatDaysSince(getDaysSince(stats.lastSeenAt)) : '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Stats */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {lang === 'ru' ? 'Статистика' : 'Statistics'}
                    </h3>
                    <div className="space-y-1.5">
                      <div className="p-2 rounded bg-blue-500/5 border border-blue-500/10">
                        <div className="flex items-center gap-1 mb-0.5">
                          <HardDrive className="w-3 h-3 text-blue-500" />
                          <span className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'Трафик' : 'Traffic'}</span>
                        </div>
                        <p className="text-base font-bold">{formatBytes(stats.totalTrafficBytes || 0) as string}</p>
                      </div>
                      <div className="p-2 rounded bg-green-500/5 border border-green-500/10">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Calendar className="w-3 h-3 text-green-500" />
                          <span className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'Дней' : 'Days'}</span>
                        </div>
                        <p className="text-base font-bold">
                          <NumberFlow value={stats.daysUsed || 0} {...defaultNumberFlowConfig} />
                        </p>
                      </div>
                      {analytics && analytics.avg_session_duration > 0 && (
                        <div className="p-2 rounded bg-purple-500/5 border border-purple-500/10">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Clock className="w-3 h-3 text-purple-500" />
                            <span className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'Сессия' : 'Session'}</span>
                          </div>
                          <p className="text-xs font-bold">{formatDuration(analytics.avg_session_duration)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Calendar Heatmap - Compact */}
              <div className="p-4 space-y-2.5 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {lang === 'ru' ? 'Активность (2 мес)' : 'Activity (2 mo)'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <div className="flex gap-0.5">
                      <div className="w-2 h-2 rounded-sm bg-muted/50" />
                      <div className="w-2 h-2 rounded-sm bg-green-300" />
                      <div className="w-2 h-2 rounded-sm bg-green-500" />
                      <div className="w-2 h-2 rounded-sm bg-green-600" />
                    </div>
                    <AlertCircle className="w-2.5 h-2.5 text-red-500" title={lang === 'ru' ? 'Красная точка = разрывы' : 'Red dot = disconnects'} />
                  </div>
                </div>
                {renderCalendarHeatmap()}
              </div>

              {/* Traffic Categories - Compact */}
              {analytics && analytics.traffic_categories && Object.keys(analytics.traffic_categories).length > 0 && (
                <div className="p-4 space-y-2.5 border-b">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {lang === 'ru' ? 'Категории' : 'Categories'}
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(analytics.traffic_categories)
                      .slice(0, 6)
                      .map(([category, data]) => {
                        const categoryInfo = categoryIcons[category] || categoryIcons.other;
                        const percentage = (data as any).percent || 0;
                        const bytes = (data as any).bytes || 0;

                        return (
                          <div key={category} className="space-y-0.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className={categoryInfo.color}>
                                  {categoryInfo.icon}
                                </div>
                                <span className="font-medium text-xs">
                                  {categoryInfo.label[lang]}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {percentage}%
                                </span>
                                <span className="font-medium text-xs">
                                  {formatBytes(bytes) as string}
                                </span>
                              </div>
                            </div>
                            <Progress value={percentage} className="h-1" />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Quality - Ultra Compact */}
              {deviceInfo && (
                <div className="p-4 space-y-2.5 border-b">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {lang === 'ru' ? 'Качество' : 'Quality'}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <Wifi className={`w-3.5 h-3.5 mx-auto mb-0.5 ${
                        deviceInfo.avg_quality >= 80 ? 'text-green-500' :
                        deviceInfo.avg_quality >= 50 ? 'text-yellow-500' : 'text-red-500'
                      }`} />
                      <p className={`text-lg font-bold ${
                        deviceInfo.avg_quality >= 80 ? 'text-green-600 dark:text-green-400' :
                        deviceInfo.avg_quality >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {deviceInfo.avg_quality}%
                      </p>
                      <p className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'Рейтинг' : 'Rating'}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <Zap className="w-3.5 h-3.5 mx-auto mb-0.5 text-orange-500" />
                      <p className="text-lg font-bold">{deviceInfo.total_disconnects || 0}</p>
                      <p className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'Разрывов' : 'Disconnects'}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <Smartphone className="w-3.5 h-3.5 mx-auto mb-0.5 text-blue-500" />
                      <p className="text-lg font-bold">{deviceInfo.online_devices || 0}</p>
                      <p className="text-[9px] text-muted-foreground">{lang === 'ru' ? 'Онлайн' : 'Online'}</p>
                    </div>
                  </div>
                  {deviceInfo.sharing_suspected && (
                    <div className="flex items-start gap-1.5 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded">
                      <AlertTriangle className="w-3 h-3 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                      <div className="text-[10px]">
                        <span className="font-medium text-orange-900 dark:text-orange-100">
                          {lang === 'ru' ? '⚠️ Sharing: ' : '⚠️ Sharing: '}
                        </span>
                        <span className="text-orange-700 dark:text-orange-300">
                          {deviceInfo.estimated_devices} {lang === 'ru' ? 'устр' : 'dev'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Top IPs - Super Compact with Sparkline */}
              {deviceInfo && (
                <div className="p-4 space-y-2.5 border-b">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {lang === 'ru' ? 'Топ-10 IP' : 'Top 10 IPs'}
                    </h3>
                  </div>
                  {deviceInfo.devices && deviceInfo.devices.length > 0 ? (
                    <div className="space-y-1.5">
                      {deviceInfo.devices
                        .sort((a, b) => b.total_connections - a.total_connections)
                        .slice(0, 10)
                        .map((device, idx) => {
                          const isOnline = device.is_online;
                          const ipHistory = ipHistories.get(device.ip);
                          const sparklineData = ipHistory?.daily_connections?.map(d => d.connections) || [];
                          const isShared = ipHistory?.shared_ip || false;
                          const otherUsers = ipHistory?.other_users || [];
                          const hasConcurrent = otherUsers.some(u => u.concurrent);

                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded text-[10px] ${
                                isOnline ? 'bg-green-500/5 border border-green-500/20' :
                                isShared ? 'bg-orange-500/5 border border-orange-500/20' :
                                'bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <div className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                    isOnline ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {idx + 1}
                                  </div>
                                  <span className="font-mono text-[11px] font-medium truncate" title={device.ip}>
                                    {device.ip}
                                  </span>
                                  {isOnline && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                                  {isShared && (
                                    <div className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400" title={`${lang === 'ru' ? 'IP используется' : 'IP shared with'}: ${ipHistory?.other_users?.map(u => u.email).join(', ')}`}>
                                      <Users className="w-3 h-3" />
                                      <span className="text-[9px] font-bold">+{otherUsers.length}</span>
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className={`text-[9px] h-4 px-1 ${
                                  device.quality_score >= 80 ? 'text-green-600 dark:text-green-400' :
                                  device.quality_score >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                                  'text-red-600 dark:text-red-400'
                                } border-current/30`}>
                                  {device.quality_score}%
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                  <span>{device.total_connections.toLocaleString()}</span>
                                  <span>•</span>
                                  <span>{formatTimestampFull(device.last_seen)}</span>
                                  {device.disconnect_count > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-orange-500 font-medium">{device.disconnect_count} {lang === 'ru' ? 'разр' : 'disc'}</span>
                                    </>
                                  )}
                                </div>
                                {sparklineData.length > 0 && (
                                  <Sparkline data={sparklineData} className="text-blue-500" />
                                )}
                              </div>

                              {/* Other Users - Detailed Badges */}
                              {otherUsers.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap mt-2 pt-2 border-t border-border/50">
                                  <div className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400 text-[9px]">
                                    <Users className="w-3 h-3" />
                                    <span className="font-bold">+{otherUsers.length}</span>
                                  </div>
                                  {otherUsers.slice(0, 5).map((otherUser, i) => (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="text-[8px] h-4 px-1 text-orange-600 dark:text-orange-400 border-orange-500/30"
                                      title={`${otherUser.email}\n${lang === 'ru' ? 'Пересечений' : 'Shared'}: ${otherUser.same_time_days} ${lang === 'ru' ? 'дней' : 'days'}`}
                                    >
                                      {otherUser.alias || otherUser.email.split('@')[0]}
                                    </Badge>
                                  ))}
                                  {otherUsers.length > 5 && (
                                    <span className="text-[8px] text-muted-foreground">
                                      +{otherUsers.length - 5}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Concurrent Warning */}
                              {hasConcurrent && (
                                <div className="mt-1.5">
                                  {otherUsers.filter(u => u.concurrent).map((concurrentUser, i) => (
                                    <Badge
                                      key={i}
                                      variant="destructive"
                                      className="text-[8px] h-4 px-1.5 mr-1"
                                      title={`${lang === 'ru' ? 'Использовали IP в одно время' : 'Used IP at the same time'} ${concurrentUser.same_time_days} ${lang === 'ru' ? 'дней' : 'days'}`}
                                    >
                                      {lang === 'ru' ? 'ОДНОВРЕМЕННО!' : 'CONCURRENT!'}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {/* Last 7 Active Days with Sessions */}
                              {ipHistory?.last_7_active_days && ipHistory.last_7_active_days.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                                  <div className="text-[9px] text-muted-foreground font-semibold mb-1">
                                    {lang === 'ru' ? 'Последние 7 дней:' : 'Last 7 days:'}
                                  </div>
                                  {ipHistory.last_7_active_days.map((day: any, dayIdx: number) => (
                                    <div key={dayIdx} className="text-[9px]">
                                      <div className="font-medium text-foreground/80 mb-0.5">
                                        {formatDate(day.date)}:
                                      </div>
                                      {day.sessions && day.sessions.length > 0 ? (
                                        <div className="ml-2 space-y-0.5">
                                          {day.sessions.map((session: any, sessIdx: number) => (
                                            <div key={sessIdx} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                              <span>•</span>
                                              <span className="font-mono text-foreground/70">{session.range}</span>
                                              <span className="text-muted-foreground/80">
                                                ({session.connections.toLocaleString()} {lang === 'ru' ? 'подкл' : 'conn'})
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="ml-2 text-[9px] text-muted-foreground">
                                          <span>•</span>
                                          <span className="ml-1 font-mono text-foreground/70">{day.time_range || '-'}</span>
                                          <span className="ml-1">
                                            ({day.total_connections?.toLocaleString() || 0} {lang === 'ru' ? 'подкл' : 'conn'})
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Traffic for 60 days */}
                              {ipHistory?.total_traffic_bytes && ipHistory.total_traffic_bytes > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                  <div className="text-[9px] text-muted-foreground">
                                    <span className="font-semibold">
                                      {lang === 'ru' ? 'Трафик за 60 дней:' : 'Traffic (60 days):'}
                                    </span>
                                    <span className="ml-1.5 font-medium text-foreground">
                                      ~{formatBytes(ipHistory.total_traffic_bytes)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        {lang === 'ru' ? 'Нет данных о подключениях' : 'No connection data'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lang === 'ru'
                          ? 'Подключитесь к VPN чтобы увидеть IP статистику'
                          : 'Connect to VPN to see IP statistics'}
                      </p>
                    </div>
                  )}
                </div>
              )}


              {/* Top Domains - Compact */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {lang === 'ru' ? 'Топ-10 доменов' : 'Top 10 Domains'}
                  </h3>
                </div>
                {stats.top3Domains && stats.top3Domains.length > 0 ? (
                  <div className="space-y-1.5">
                    {stats.top3Domains.map((domain: any, idx: number) => {
                      const percentage = domain.sharePct || 0;
                      return (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <div className="w-4 h-4 rounded bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground shrink-0">
                                {idx + 1}
                              </div>
                              {getDomainIcon(domain.domain)}
                              <span className="font-mono text-[10px] truncate" title={domain.domain}>
                                {domain.domain}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] text-muted-foreground">
                                {percentage.toFixed(1)}%
                              </span>
                              <span className="font-medium text-[10px]">
                                {formatBytes(domain.trafficBytes) as string}
                              </span>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-0.5" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    {lang === 'ru' ? 'Нет данных' : 'No data'}
                  </p>
                )}
              </div>

              {/* Footer - Minimal */}
              <div className="p-4 pt-2">
                <div className="p-2 rounded bg-muted/20 text-[9px] text-muted-foreground">
                  <div className="truncate" title={user.uuid}>UUID: {user.uuid.slice(0, 24)}...</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {lang === 'ru' ? 'Нет данных' : 'No data'}
            </div>
          )}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
