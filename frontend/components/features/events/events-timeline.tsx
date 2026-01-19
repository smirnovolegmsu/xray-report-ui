'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { handleApiError } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type { EventsTimelinePoint } from '@/types';
import { Clock } from 'lucide-react';

interface EventsTimelineProps {
  hours?: number;
}

export function EventsTimeline({ hours = 24 }: EventsTimelineProps) {
  const [timeline, setTimeline] = useState<EventsTimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadTimeline();
    const interval = setInterval(loadTimeline, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [hours]);

  const loadTimeline = async () => {
    try {
      const response = await apiClient.getEventsStats(hours);
      setTimeline(response.data.timeline || []);
      setLoading(false);
    } catch (error) {
      if (loading) {
        toast.error(handleApiError(error));
      }
      setLoading(false);
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
    return null;
  }

  const maxCount = Math.max(...timeline.map((p) => p.count), 1);

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        {lang === 'ru' 
          ? `События за последние ${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`
          : `Events over the last ${hours} hour${hours === 1 ? '' : 's'}`
        }
      </h3>

      <div className="space-y-2">
        {/* Timeline Chart */}
        <div className="flex items-end gap-1 h-32">
          {timeline.map((point, idx) => {
            const heightPercent = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
            const hasErrors = point.errors > 0;
            const hasWarnings = point.warnings > 0 && !hasErrors;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center group relative"
              >
                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all ${
                    hasErrors
                      ? 'bg-red-500 dark:bg-red-600'
                      : hasWarnings
                      ? 'bg-yellow-500 dark:bg-yellow-600'
                      : 'bg-blue-500 dark:bg-blue-600'
                  } ${point.count > 0 ? 'opacity-100' : 'opacity-20 bg-muted'}`}
                  style={{ height: `${heightPercent}%`, minHeight: point.count > 0 ? '4px' : '2px' }}
                ></div>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                  <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs whitespace-nowrap">
                    <div className="font-medium mb-1">
                      {new Date(point.timestamp).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="space-y-0.5 text-muted-foreground">
                      <div>
                        {lang === 'ru' ? 'Всего' : 'Total'}: <span className="font-medium text-foreground">{point.count}</span>
                      </div>
                      {point.errors > 0 && (
                        <div className="text-red-600 dark:text-red-400">
                          {lang === 'ru' ? 'Ошибки' : 'Errors'}: <span className="font-medium">{point.errors}</span>
                        </div>
                      )}
                      {point.warnings > 0 && (
                        <div className="text-yellow-600 dark:text-yellow-400">
                          {lang === 'ru' ? 'Предупр.' : 'Warnings'}: <span className="font-medium">{point.warnings}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>
            {new Date(timeline[0]?.timestamp || Date.now()).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
            })}
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
