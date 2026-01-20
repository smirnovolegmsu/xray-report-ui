'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { handleApiError } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type { EventsTimelinePoint } from '@/types';
import { Clock } from 'lucide-react';

import type { EventType, EventSeverity } from '@/types';

interface EventsTimelineProps {
  hours?: number;
  typeFilter?: EventType | 'ALL';
  severityFilter?: EventSeverity | 'ALL';
  onHourClick?: (timestamp: number) => void;
  selectedHour?: number;
}

export function EventsTimeline({ 
  hours = 24,
  typeFilter = 'ALL',
  severityFilter = 'ALL',
  onHourClick,
  selectedHour
}: EventsTimelineProps) {
  const [timeline, setTimeline] = useState<EventsTimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadTimeline();
    const interval = setInterval(loadTimeline, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [hours, typeFilter, severityFilter]);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getEventsStats(hours);
      
      // API возвращает { ok: true, timeline: [...] }
      // axios оборачивает это в response.data, так что response.data = { ok: true, timeline: [...] }
      const timelineData = response.data?.timeline || [];
      
      // Debug logging - всегда показываем для диагностики
      console.log('[EventsTimeline] Loading timeline:', {
        hours,
        responseStatus: response.status,
        responseDataKeys: Object.keys(response.data || {}),
        timelineLength: timelineData.length,
        timelineSample: timelineData.slice(0, 3),
        maxCount: timelineData.length > 0 ? Math.max(...timelineData.map(p => p.count || 0)) : 0,
        firstPoint: timelineData[0],
        lastPoint: timelineData[timelineData.length - 1]
      });
      
      if (timelineData.length === 0) {
        console.warn('[EventsTimeline] No timeline data received!');
      }
      
      setTimeline(timelineData);
      setLoading(false);
    } catch (error) {
      const errorMessage = handleApiError(error);
      console.error('[EventsTimeline] Failed to load timeline:', error, errorMessage);
      if (loading) {
        toast.error(lang === 'ru' 
          ? `Ошибка загрузки графика: ${errorMessage}` 
          : `Failed to load timeline: ${errorMessage}`
        );
      }
      setLoading(false);
      setTimeline([]); // Set empty array on error
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-32"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          {lang === 'ru' 
            ? `События за ${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`
            : `Events (${hours}h)`
          }
        </h3>
        <div className="text-center py-8 text-muted-foreground text-xs">
          {lang === 'ru' ? 'Нет данных за выбранный период' : 'No data for selected period'}
        </div>
      </Card>
    );
  }

  const maxCount = timeline.length > 0 ? Math.max(...timeline.map((p) => p.count), 1) : 1;

  return (
    <Card className="p-4">
      <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        {lang === 'ru' 
          ? `События за ${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`
          : `Events (${hours}h)`
        }
      </h3>

      <div className="space-y-2">
        {/* Stacked Timeline Chart - показывает распределение по уровням */}
        <div className="flex items-end gap-0.5 h-48 min-h-[192px] border-b border-border bg-muted/10">
          {timeline.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
              {lang === 'ru' ? 'Нет данных для отображения' : 'No data to display'}
            </div>
          ) : (
            timeline.map((point, idx) => {
            const infoCount = Math.max(0, point.count - point.errors - point.warnings);
            const totalInPoint = point.count;
            
            // Calculate heights as percentages of maxCount
            const infoPercent = maxCount > 0 && totalInPoint > 0 ? (infoCount / maxCount) * 100 : 0;
            const warningsPercent = maxCount > 0 && totalInPoint > 0 ? (point.warnings / maxCount) * 100 : 0;
            const errorsPercent = maxCount > 0 && totalInPoint > 0 ? (point.errors / maxCount) * 100 : 0;
            const totalPercent = Math.max(infoPercent + warningsPercent + errorsPercent, 0);

            // Ensure minimum visibility for bars with data
            const barHeight = totalInPoint > 0 
              ? Math.max(totalPercent, 3) // At least 3% for bars with data
              : 2; // 2% for empty bars

            const isSelected = selectedHour === point.timestamp;
            const shouldShow = 
              (typeFilter === 'ALL' && severityFilter === 'ALL') ||
              (severityFilter === 'ALL' && point.count > 0) ||
              (severityFilter === 'ERROR' && point.errors > 0) ||
              (severityFilter === 'WARN' && point.warnings > 0) ||
              (severityFilter === 'INFO' && infoCount > 0);
            
            if (!shouldShow && (typeFilter !== 'ALL' || severityFilter !== 'ALL')) {
              return null;
            }
            
            // Calculate layer heights relative to the total stacked value
            const totalStacked = infoCount + point.warnings + point.errors;
            const infoLayerHeight = totalStacked > 0 ? (infoCount / totalStacked) * 100 : (infoCount > 0 ? 100 : 0);
            const warningsLayerHeight = totalStacked > 0 ? (point.warnings / totalStacked) * 100 : (point.warnings > 0 ? 100 : 0);
            const errorsLayerHeight = totalStacked > 0 ? (point.errors / totalStacked) * 100 : (point.errors > 0 ? 100 : 0);
            
            return (
              <div
                key={`${point.timestamp}-${idx}`}
                className="flex-1 flex flex-col items-center group relative min-w-[4px]"
              >
                {/* Stacked Bar: INFO (bottom), WARN (middle), ERROR (top) */}
                <div
                  className={`w-full rounded-t transition-all cursor-pointer relative border border-transparent ${
                    isSelected 
                      ? 'ring-2 ring-primary ring-offset-1 z-10'
                      : ''
                  } ${point.count > 0 ? 'hover:opacity-90 hover:border-border' : 'opacity-30'}`}
                  style={{ height: `${barHeight}%` }}
                  onClick={() => onHourClick?.(point.timestamp)}
                >
                  {/* INFO layer (bottom, blue) */}
                  {infoCount > 0 && (
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-blue-500 dark:bg-blue-600"
                      style={{ height: `${infoLayerHeight}%` }}
                    />
                  )}
                  {/* WARN layer (middle, yellow) */}
                  {point.warnings > 0 && (
                    <div
                      className="absolute left-0 right-0 bg-yellow-500 dark:bg-yellow-600"
                      style={{ 
                        bottom: `${infoLayerHeight}%`,
                        height: `${warningsLayerHeight}%` 
                      }}
                    />
                  )}
                  {/* ERROR layer (top, red) */}
                  {point.errors > 0 && (
                    <div
                      className="absolute left-0 right-0 bg-red-500 dark:bg-red-600 rounded-t"
                      style={{ 
                        bottom: `${infoLayerHeight + warningsLayerHeight}%`,
                        height: `${errorsLayerHeight}%` 
                      }}
                    />
                  )}
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs whitespace-nowrap">
                    <div className="font-medium mb-1.5">
                      {new Date(point.timestamp).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <span>{lang === 'ru' ? 'Всего' : 'Total'}:</span>
                        <span className="font-medium text-foreground">{point.count}</span>
                      </div>
                      {point.errors > 0 && (
                        <div className="flex items-center justify-between gap-3 text-red-600 dark:text-red-400">
                          <span>{lang === 'ru' ? 'Ошибки' : 'Errors'}:</span>
                          <span className="font-medium">{point.errors}</span>
                        </div>
                      )}
                      {point.warnings > 0 && (
                        <div className="flex items-center justify-between gap-3 text-yellow-600 dark:text-yellow-400">
                          <span>{lang === 'ru' ? 'Предупр.' : 'Warnings'}:</span>
                          <span className="font-medium">{point.warnings}</span>
                        </div>
                      )}
                      {infoCount > 0 && (
                        <div className="flex items-center justify-between gap-3 text-blue-600 dark:text-blue-400">
                          <span>{lang === 'ru' ? 'Инфо' : 'Info'}:</span>
                          <span className="font-medium">{infoCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>

        {/* Time Labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>
            {hours > 168
              ? new Date(timeline[0]?.timestamp || Date.now()).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : new Date(timeline[0]?.timestamp || Date.now()).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                })
            }
          </span>
          <span>{lang === 'ru' ? 'Сейчас' : 'Now'}</span>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500 dark:bg-blue-600"></div>
            <span className="text-muted-foreground">{lang === 'ru' ? 'Норма' : 'Normal'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-yellow-500 dark:bg-yellow-600"></div>
            <span className="text-muted-foreground">{lang === 'ru' ? 'Предупр.' : 'Warnings'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500 dark:bg-red-600"></div>
            <span className="text-muted-foreground">{lang === 'ru' ? 'Ошибки' : 'Errors'}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
