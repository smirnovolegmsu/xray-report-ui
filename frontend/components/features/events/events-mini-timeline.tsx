'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { handleApiError, devLog } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { EventsTimelinePoint } from '@/types';

interface EventsMiniTimelineProps {
  hours?: number;
  onHourClick?: (timestamp: number) => void;
  selectedHour?: number;
  className?: string;
}

export function EventsMiniTimeline({
  hours = 24,
  onHourClick,
  selectedHour,
  className
}: EventsMiniTimelineProps) {
  const [timeline, setTimeline] = useState<EventsTimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadTimeline();
    const interval = setInterval(loadTimeline, 30000);
    return () => clearInterval(interval);
  }, [hours]);

  const loadTimeline = async () => {
    try {
      const response = await apiClient.getEventsStats(hours);
      const timelineData = response.data?.timeline || [];
      setTimeline(timelineData);
      setLoading(false);
    } catch (error) {
      devLog.error('[MiniTimeline] Failed to load:', error);
      setLoading(false);
      setTimeline([]);
    }
  };

  const maxCount = useMemo(() => {
    if (timeline.length === 0) return 1;
    return Math.max(...timeline.map(p => p.count), 1);
  }, [timeline]);

  // Format time label
  const getTimeLabel = (isStart: boolean) => {
    if (hours <= 24) {
      return isStart ? (lang === 'ru' ? 'Сейчас' : 'Now') : `${hours}${lang === 'ru' ? 'ч' : 'h'}`;
    }
    if (hours <= 168) {
      return isStart ? (lang === 'ru' ? 'Сейчас' : 'Now') : `${Math.round(hours / 24)}${lang === 'ru' ? 'д' : 'd'}`;
    }
    return isStart ? (lang === 'ru' ? 'Сейчас' : 'Now') : `${Math.round(hours / 24)}${lang === 'ru' ? 'д' : 'd'}`;
  };

  if (loading) {
    return (
      <div className={cn('h-[60px] bg-muted/30 rounded animate-pulse', className)} />
    );
  }

  if (timeline.length === 0) {
    return (
      <div className={cn('h-[60px] flex items-center justify-center text-xs text-muted-foreground', className)}>
        {lang === 'ru' ? 'Нет данных' : 'No data'}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {/* Sparkline Chart */}
      <div className="flex items-end gap-[1px] h-[44px] px-1">
        {timeline.map((point, idx) => {
          const heightPercent = Math.max((point.count / maxCount) * 100, 4);
          const isSelected = selectedHour === point.timestamp;

          // Calculate stacked heights
          const infoCount = Math.max(0, point.count - point.errors - point.warnings);
          const total = point.count || 1;
          const infoPercent = (infoCount / total) * heightPercent;
          const warnPercent = (point.warnings / total) * heightPercent;
          const errorPercent = (point.errors / total) * heightPercent;

          return (
            <div
              key={`${point.timestamp}-${idx}`}
              className={cn(
                'flex-1 min-w-[2px] flex flex-col justify-end cursor-pointer transition-opacity',
                'hover:opacity-80',
                isSelected && 'ring-1 ring-primary ring-offset-1 rounded-sm'
              )}
              style={{ height: `${heightPercent}%` }}
              onClick={() => onHourClick?.(point.timestamp)}
              title={`${new Date(point.timestamp).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}: ${point.count} (${point.errors}err, ${point.warnings}warn)`}
            >
              {/* Stacked bar: INFO (bottom, blue), WARN (middle, yellow), ERROR (top, red) */}
              {infoCount > 0 && (
                <div
                  className="w-full bg-blue-500 dark:bg-blue-600"
                  style={{ height: `${(infoPercent / heightPercent) * 100}%` }}
                />
              )}
              {point.warnings > 0 && (
                <div
                  className="w-full bg-yellow-500 dark:bg-yellow-500"
                  style={{ height: `${(warnPercent / heightPercent) * 100}%` }}
                />
              )}
              {point.errors > 0 && (
                <div
                  className="w-full bg-red-500 dark:bg-red-500 rounded-t-[1px]"
                  style={{ height: `${(errorPercent / heightPercent) * 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Time Labels */}
      <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
        <span>{getTimeLabel(true)}</span>
        <span>{getTimeLabel(false)}</span>
      </div>
    </div>
  );
}
