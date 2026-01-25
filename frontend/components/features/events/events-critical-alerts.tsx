'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import type { Event } from '@/types';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface EventsCriticalAlertsProps {
  events: Event[];
  onFilterByService?: (service: string) => void;
  onFilterByType?: (type: string) => void;
}

export function EventsCriticalAlerts({ events, onFilterByService, onFilterByType }: EventsCriticalAlertsProps) {
  const { lang } = useAppStore();

  // Оптимизированная обработка: один проход по событиям
  const critical = useMemo(() => {
    if (events.length === 0) {
      return {
        activeErrors: [],
        topRepeated: [],
        problematicServices: [],
        trend: 0,
        hasIssues: false,
      };
    }
    
    const errors: Event[] = [];
    const warnings: Event[] = [];
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const activeErrors: Event[] = [];
    
    // Один проход по событиям для классификации
    for (const e of events) {
      if (e.severity === 'ERROR') {
        errors.push(e);
        if (new Date(e.ts).getTime() > fiveMinutesAgo) {
          activeErrors.push(e);
        }
      } else if (e.severity === 'WARN') {
        warnings.push(e);
      }
    }
    
    // Повторяющиеся проблемы (топ-3) с улучшенной группировкой
    const repeatedIssues = events.reduce((acc, e) => {
      if (e.severity === 'ERROR' || e.severity === 'WARN') {
        const key = `${e.type}-${e.action}-${e.service || ''}`;
        const eventTime = new Date(e.ts);
        if (!acc[key]) {
          acc[key] = { 
            count: 0, 
            event: e, 
            firstSeen: eventTime,
            lastSeen: eventTime,
            events: [e]
          };
        }
        acc[key].count++;
        if (eventTime < acc[key].firstSeen) {
          acc[key].firstSeen = eventTime;
        }
        if (eventTime > acc[key].lastSeen) {
          acc[key].lastSeen = eventTime;
        }
        acc[key].events.push(e);
      }
      return acc;
    }, {} as Record<string, { 
      count: number; 
      event: Event; 
      firstSeen: Date;
      lastSeen: Date;
      events: Event[];
    }>);

    const topRepeated = Object.entries(repeatedIssues)
      .filter(([, data]) => data.count > 1)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 3);

    // Проблемные сервисы (топ-3)
    const errorsByService = errors.reduce((acc, e) => {
      const service = e.service || e.target || 'Unknown';
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const problematicServices = Object.entries(errorsByService)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    // Тренд ошибок
    const sortedErrors = [...errors].sort((a, b) => 
      new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
    const midPoint = Math.floor(sortedErrors.length / 2);
    const firstHalf = sortedErrors.slice(0, midPoint).length;
    const secondHalf = sortedErrors.slice(midPoint).length;
    const trend = firstHalf > 0 
      ? ((secondHalf - firstHalf) / firstHalf) * 100 
      : secondHalf > 0 ? 100 : 0;

    return {
      activeErrors,
      topRepeated,
      problematicServices,
      trend,
      hasIssues: errors.length > 0 || warnings.length > 0,
    };
  }, [events]);

  if (!critical.hasIssues) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Активные ошибки - всегда видно, компактно */}
      {critical.activeErrors.length > 0 && (
        <Card className="p-2.5 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs font-semibold text-red-900 dark:text-red-100">
                {lang === 'ru' ? 'Активные ошибки' : 'Active Errors'}
              </span>
              <Badge variant="destructive" className="text-xs">
                {critical.activeErrors.length}
              </Badge>
            </div>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                >
                  {lang === 'ru' ? 'Детали' : 'Details'} <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-1.5 p-2.5">
                  <div className="space-y-1.5">
                    {critical.activeErrors.slice(0, 10).map((event, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs p-1.5 bg-muted/50 rounded">
                        <Badge variant="destructive" className="text-xs mt-0.5 shrink-0">
                          {event.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-xs">
                            {event.service || event.type} - {event.action}
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-xs">
                            {new Date(event.ts).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                    {critical.activeErrors.length > 10 && (
                      <div className="text-xs text-muted-foreground text-center p-1.5">
                        {lang === 'ru' 
                          ? `... и еще ${critical.activeErrors.length - 10} событий`
                          : `... and ${critical.activeErrors.length - 10} more events`}
                      </div>
                    )}
                  </div>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </Card>
      )}

    </div>
  );
}
