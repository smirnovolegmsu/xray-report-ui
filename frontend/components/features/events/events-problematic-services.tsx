'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import type { Event } from '@/types';
import { AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';

interface EventsProblematicServicesProps {
  events: Event[];
  onFilterByService?: (service: string) => void;
}

export function EventsProblematicServices({ events, onFilterByService }: EventsProblematicServicesProps) {
  const { lang } = useAppStore();

  const problematicServices = useMemo(() => {
    const errors = events.filter(e => e.severity === 'ERROR');
    
    const errorsByService = errors.reduce((acc, e) => {
      const service = e.service || e.target || 'Unknown';
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorsByService)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [events]);

  return (
    <Card className="p-3">
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium">
                {lang === 'ru' ? 'Проблемные сервисы' : 'Problematic Services'}
              </span>
              {problematicServices.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {problematicServices.length}
                </Badge>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {problematicServices.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-xs">
              {lang === 'ru' ? 'Нет проблемных сервисов' : 'No problematic services'}
            </div>
          ) : (
            <div className="space-y-2">
              {problematicServices.map(([service, count]) => {
              const serviceEvents = events.filter(e => 
                (e.service || e.target || 'Unknown') === service && 
                (e.severity === 'ERROR' || e.severity === 'WARN')
              ).slice(0, 5);
              
              return (
                <Collapsible key={service}>
                  <CollapsibleTrigger asChild>
                    <div 
                      className="flex items-center justify-between text-xs cursor-pointer hover:bg-muted/50 rounded p-2 -mx-1 transition-colors"
                      onClick={() => onFilterByService?.(service)}
                    >
                      <span className="truncate flex-1 font-medium">{service}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="destructive" className="text-xs">
                          {count}
                        </Badge>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 ml-2 space-y-1 border-l-2 border-muted pl-2">
                      {serviceEvents.map((event, idx) => (
                        <div key={idx} className="text-xs p-1.5 bg-muted/30 rounded">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Badge variant={event.severity === 'ERROR' ? 'destructive' : 'secondary'} className="text-xs px-1 py-0 shrink-0">
                              {event.severity}
                            </Badge>
                            <span className="text-muted-foreground font-mono text-xs">
                              {new Date(event.ts).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="text-muted-foreground truncate text-xs">
                            {event.action || event.message || event.type}
                          </div>
                        </div>
                      ))}
                      {serviceEvents.length < count && (
                        <div className="text-xs text-muted-foreground p-1">
                          {lang === 'ru' 
                            ? `... и еще ${count - serviceEvents.length} событий`
                            : `... and ${count - serviceEvents.length} more events`}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
