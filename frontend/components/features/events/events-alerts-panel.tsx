'use client';

import { useMemo } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Server, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Event } from '@/types';

interface EventsAlertsPanelProps {
  events: Event[];
  onFilter?: (type: 'severity' | 'type' | 'search', value: string) => void;
  className?: string;
}

export function EventsAlertsPanel({ events, onFilter, className }: EventsAlertsPanelProps) {
  const { lang } = useAppStore();

  const analysis = useMemo(() => {
    const errors = events.filter(e => e.severity === 'ERROR').length;
    const warnings = events.filter(e => e.severity === 'WARN').length;
    const infos = events.filter(e => e.severity === 'INFO').length;

    // Check for services currently down (down event without subsequent recovery)
    const servicesDown: string[] = [];
    const serviceDownEvents = events.filter(e => e.type === 'SERVICE_HEALTH' && e.action === 'service_down');
    const serviceUpEvents = events.filter(e => e.type === 'SERVICE_HEALTH' && e.action === 'service_up');

    const serviceLastState = new Map<string, { isDown: boolean; ts: number }>();

    // Process all service events chronologically (oldest first)
    const allServiceEvents = [...serviceDownEvents, ...serviceUpEvents].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );

    allServiceEvents.forEach(e => {
      const service = e.service || 'unknown';
      serviceLastState.set(service, {
        isDown: e.action === 'service_down',
        ts: new Date(e.ts).getTime()
      });
    });

    serviceLastState.forEach((state, service) => {
      if (state.isDown) {
        servicesDown.push(service);
      }
    });

    return { errors, warnings, infos, servicesDown, total: events.length };
  }, [events]);

  const { errors, warnings, infos, servicesDown, total } = analysis;

  // Determine overall status
  const hasProblems = errors > 0 || servicesDown.length > 0;
  const hasWarnings = warnings > 0;

  // All good - green minimal bar
  if (!hasProblems && !hasWarnings) {
    return (
      <div className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg border',
        'bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/50',
        className
      )}>
        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
        <span className="text-sm text-green-700 dark:text-green-300">
          {lang === 'ru' ? 'Нет проблем' : 'No issues'}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {total} {lang === 'ru' ? 'событий' : 'events'}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border flex-wrap',
      hasProblems
        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/50'
        : 'bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200/50 dark:border-yellow-800/50',
      className
    )}>
      {/* Services down */}
      {servicesDown.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Server className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            {servicesDown.join(', ')} {lang === 'ru' ? 'недоступен' : 'down'}
          </span>
          <span className="text-muted-foreground mx-1">·</span>
        </div>
      )}

      {/* Errors count */}
      {errors > 0 && (
        <Badge
          variant="outline"
          className="bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 cursor-pointer hover:bg-red-200 dark:hover:bg-red-900/50"
          onClick={() => onFilter?.('severity', 'ERROR')}
        >
          <XCircle className="w-3 h-3 mr-1" />
          {errors} {lang === 'ru' ? 'ошибок' : 'errors'}
        </Badge>
      )}

      {/* Warnings count */}
      {warnings > 0 && (
        <Badge
          variant="outline"
          className="bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
          onClick={() => onFilter?.('severity', 'WARN')}
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          {warnings} {lang === 'ru' ? 'предупр.' : 'warnings'}
        </Badge>
      )}

      {/* Info count */}
      {infos > 0 && (
        <Badge
          variant="outline"
          className="bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50"
          onClick={() => onFilter?.('severity', 'INFO')}
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          {infos} {lang === 'ru' ? 'инфо' : 'info'}
        </Badge>
      )}

      {/* Total */}
      <span className="text-xs text-muted-foreground ml-auto">
        {total} {lang === 'ru' ? 'событий' : 'events'}
      </span>
    </div>
  );
}
