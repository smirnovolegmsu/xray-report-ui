'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import type { Event } from '@/types';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

interface EventsTrendAndRepeatedProps {
  events: Event[];
}

export function EventsTrendAndRepeated({ events }: EventsTrendAndRepeatedProps) {
  const { lang } = useAppStore();

  const data = useMemo(() => {
    if (events.length === 0) {
      return {
        trend: 0,
        topRepeated: [],
        hasData: false,
      };
    }

    const errors = events.filter(e => e.severity === 'ERROR');
    
    // Повторяющиеся проблемы
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
      .slice(0, 5);

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
      trend,
      topRepeated,
      hasData: errors.length > 0 || topRepeated.length > 0,
    };
  }, [events]);

  return (
    <div className="space-y-3">
      {/* Тренд */}
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.trend !== 0 ? (
              data.trend > 0 ? (
                <TrendingUp className="w-4 h-4 text-red-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-600" />
              )
            ) : (
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {lang === 'ru' ? 'Тренд' : 'Trend'}
            </span>
          </div>
          {data.trend !== 0 ? (
            <span className={`text-sm font-semibold ${data.trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.trend > 0 ? '+' : ''}{data.trend.toFixed(0)}%
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {lang === 'ru' ? 'Нет данных' : 'No data'}
            </span>
          )}
        </div>
      </Card>

      {/* Повторяющиеся проблемы */}
      {data.topRepeated.length > 0 ? (
        <Card className="p-3">
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium">
                    {lang === 'ru' ? 'Повторяющиеся проблемы' : 'Repeated Issues'}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {data.topRepeated.length}
                  </Badge>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2">
                {data.topRepeated.map(([key, issueData]) => {
                  const hoursAgo = (Date.now() - issueData.lastSeen.getTime()) / (1000 * 60 * 60);
                  const durationMs = issueData.lastSeen.getTime() - issueData.firstSeen.getTime();
                  const durationHours = durationMs / (1000 * 60 * 60);
                  const isActive = hoursAgo < 0.083; // Менее 5 минут
                  
                  return (
                    <div 
                      key={key} 
                      className={`p-2 rounded text-xs ${
                        isActive 
                          ? 'bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800' 
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {issueData.event.service || issueData.event.type}
                          </div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {issueData.event.action}
                          </div>
                        </div>
                        <Badge variant={issueData.count > 5 ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                          {issueData.count}x
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-xs space-y-0.5">
                        {durationHours > 0 && (
                          <div>
                            {durationHours < 1 
                              ? `${Math.floor(durationHours * 60)}${lang === 'ru' ? 'мин' : 'm'}`
                              : `${Math.floor(durationHours)}${lang === 'ru' ? 'ч' : 'h'}`} {lang === 'ru' ? 'длительность' : 'duration'}
                          </div>
                        )}
                        {hoursAgo < 24 && (
                          <div>
                            {lang === 'ru' ? 'Последнее' : 'Last'}: {hoursAgo < 1 
                              ? `${Math.floor(hoursAgo * 60)}${lang === 'ru' ? 'мин' : 'm'}`
                              : `${Math.floor(hoursAgo)}${lang === 'ru' ? 'ч' : 'h'}`} {lang === 'ru' ? 'назад' : 'ago'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ) : (
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {lang === 'ru' ? 'Повторяющиеся проблемы' : 'Repeated Issues'}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {lang === 'ru' ? 'Нет данных' : 'No data'}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
