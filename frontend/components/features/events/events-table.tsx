'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import type { Event, EventType, EventSeverity } from '@/types';
import { EventIcon } from './event-icon';
import { ServiceIcon } from './service-icon';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';
import { formatEventTime } from '@/lib/time-utils';

type SortField = 'time' | 'type' | 'severity' | 'service';
type SortDirection = 'asc' | 'desc';

interface EventsTableProps {
  filter?: string;
  typeFilter?: EventType | 'ALL';
  severityFilter?: EventSeverity | 'ALL';
  timeRange?: number; // hours
  selectedHour?: number; // timestamp in ms for filtering by specific hour
  onFilteredEventsChange?: (events: Event[]) => void; // Callback to expose filtered events
  onServiceClick?: (service: string) => void; // Callback when service is clicked
}

export function EventsTable({ 
  filter: externalFilter,
  typeFilter = 'ALL',
  severityFilter = 'ALL',
  timeRange = 24,
  selectedHour,
  onFilteredEventsChange,
  onServiceClick
}: EventsTableProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<string>>(new Set());
  const { lang } = useAppStore();
  
  // Use external filter if provided, otherwise empty string
  const filter = externalFilter || '';

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadEvents = async () => {
    try {
      const response = await apiClient.getEvents({ limit: 100 });
      setEvents(response.data?.events || []);
      setLoading(false);
    } catch (error) {
      const errorMessage = handleApiError(error);
      if (loading) {
        toast.error(lang === 'ru' 
          ? `Ошибка загрузки событий: ${errorMessage}` 
          : `Failed to load events: ${errorMessage}`
        );
      }
      setLoading(false);
      console.error('Failed to load events:', error);
    }
  };

  const interpretEvent = useCallback((event: Event): string => {
    const { type, action } = event;
    
    // USER events
    if (type === 'USER') {
      if (action.includes('add')) {
        return lang === 'ru'
          ? `Добавлен пользователь: ${event.email || event.userId || '—'}`
          : `User added: ${event.email || event.userId || '—'}`;
      }
      if (action.includes('delete')) {
        return lang === 'ru'
          ? `Удалён пользователь: ${event.email || event.userId || '—'}`
          : `User deleted: ${event.email || event.userId || '—'}`;
      }
      if (action.includes('kick')) {
        return lang === 'ru'
          ? `Пользователь отключён (UUID изменён): ${event.email || event.userId || '—'}`
          : `User kicked (UUID changed): ${event.email || event.userId || '—'}`;
      }
      if (action.includes('update_alias')) {
        return lang === 'ru'
          ? `Изменён псевдоним пользователя ${event.email}: "${event.alias || '—'}"`
          : `User alias updated ${event.email}: "${event.alias || '—'}"`;
      }
      return lang === 'ru'
        ? `Действие с пользователем: ${action}`
        : `User action: ${action}`;
    }
    
    // SYSTEM events
    if (type === 'SYSTEM') {
      if (action.includes('startup')) {
        return lang === 'ru'
          ? `Запуск системы ${event.version ? `(версия ${event.version})` : ''}`
          : `System startup ${event.version ? `(version ${event.version})` : ''}`;
      }
      if (action.includes('shutdown')) {
        return lang === 'ru'
          ? 'Остановка системы'
          : 'System shutdown';
      }
      if (action.includes('restart_ui')) {
        return lang === 'ru'
          ? 'Перезапуск UI сервиса'
          : 'UI service restart';
      }
      if (action.includes('restart_xray')) {
        return lang === 'ru'
          ? `Перезапуск Xray: ${event.service || '—'}`
          : `Xray restart: ${event.service || '—'}`;
      }
      if (action.includes('restart')) {
        return lang === 'ru'
          ? `Перезапуск сервиса: ${event.target || event.service || '—'}`
          : `Service restart: ${event.target || event.service || '—'}`;
      }
      return event.message || (lang === 'ru' ? `Системное действие: ${action}` : `System action: ${action}`);
    }
    
    // SETTINGS events
    if (type === 'SETTINGS') {
      return lang === 'ru'
        ? `Сохранены настройки`
        : `Settings saved`;
    }
    
    // XRAY events
    if (type === 'XRAY') {
      if (action.includes('restart')) {
        return lang === 'ru'
          ? `Перезапущен Xray: ${event.result || '—'}`
          : `Xray restarted: ${event.result || '—'}`;
      }
      return lang === 'ru'
        ? `Действие с Xray: ${action}`
        : `Xray action: ${action}`;
    }
    
    // CONNECTION events (renamed from LINK)
    if (type === 'CONNECTION') {
      if (action.includes('build_failed')) {
        return lang === 'ru'
          ? `Ошибка генерации ссылки для ${event.email}: ${event.error || '—'}`
          : `Link generation failed for ${event.email}: ${event.error || '—'}`;
      }
      if (action.includes('built')) {
        return lang === 'ru'
          ? `Сгенерирована ссылка подключения для ${event.email}`
          : `Connection link generated for ${event.email}`;
      }
      return event.message || action;
    }
    
    // COLLECTOR events
    if (type === 'COLLECTOR') {
      if (action.includes('toggle')) {
        const status = event.enabled ? (lang === 'ru' ? 'включён' : 'enabled') : (lang === 'ru' ? 'выключен' : 'disabled');
        return lang === 'ru'
          ? `Сборщик данных ${status}`
          : `Data collector ${status}`;
      }
      return event.message || action;
    }
    
    // SERVICE_HEALTH events
    if (type === 'SERVICE_HEALTH') {
      if (action.includes('service_down')) {
        const serviceName = event.service || '—';
        const port = event.port ? ` (порт ${event.port})` : '';
        return lang === 'ru'
          ? `Сервис ${serviceName}${port} недоступен`
          : `Service ${serviceName}${port} is down`;
      }
      if (action.includes('service_up')) {
        const serviceName = event.service || '—';
        const port = event.port ? ` (порт ${event.port})` : '';
        return lang === 'ru'
          ? `Сервис ${serviceName}${port} восстановлен`
          : `Service ${serviceName}${port} is up`;
      }
      if (action.includes('service_slow')) {
        return lang === 'ru'
          ? `Медленный ответ от ${event.service}: ${event.duration_ms}ms`
          : `Slow response from ${event.service}: ${event.duration_ms}ms`;
      }
      return event.message || action;
    }
    
    // APP_ERROR events
    if (type === 'APP_ERROR') {
      if (action.includes('exception')) {
        return lang === 'ru'
          ? `Ошибка приложения: ${event.error || event.message || '—'}`
          : `Application error: ${event.error || event.message || '—'}`;
      }
      return event.message || (lang === 'ru' ? `Ошибка: ${event.error || action}` : `Error: ${event.error || action}`);
    }
    
    // PERFORMANCE events
    if (type === 'PERFORMANCE') {
      if (action.includes('slow_response')) {
        return lang === 'ru'
          ? `Медленный ответ API: ${event.duration_ms}ms (${event.endpoint})`
          : `Slow API response: ${event.duration_ms}ms (${event.endpoint})`;
      }
      if (action.includes('high_load')) {
        return lang === 'ru'
          ? `Высокая загрузка системы`
          : `High system load`;
      }
      return event.message || action;
    }
    
    // UPDATE events
    if (type === 'UPDATE') {
      if (action.includes('new_version')) {
        return lang === 'ru'
          ? `Доступна новая версия: ${event.latest} (текущая: ${event.current})`
          : `New version available: ${event.latest} (current: ${event.current})`;
      }
      return event.message || action;
    }
    
    // Fallback
    return event.message || action || '—';
  }, [lang]);

  // Дедупликация событий - группируем дубли по времени (минута) + тип + action + описание
  // Оптимизировано: используем Map для O(1) поиска, ограничиваем длину описания
  const deduplicatedEvents = useMemo(() => {
    if (events.length === 0) return [];
    
    const seen = new Map<string, { event: Event; count: number; duplicates: Event[] }>();
    const result: Array<Event & { _duplicateCount?: number; _duplicateKey?: string; _duplicates?: Event[] }> = [];
    
    // Предварительно вычисляем ключи для оптимизации
    for (const event of events) {
      const eventTime = new Date(event.ts);
      const timeKey = `${eventTime.getFullYear()}-${String(eventTime.getMonth() + 1).padStart(2, '0')}-${String(eventTime.getDate()).padStart(2, '0')}-${String(eventTime.getHours()).padStart(2, '0')}-${String(eventTime.getMinutes()).padStart(2, '0')}`;
      const description = (event.message || event.action || event.type || '').substring(0, 100);
      const key = `${timeKey}-${event.type}-${event.action || ''}-${event.service || ''}-${description}`;
      
      const existing = seen.get(key);
      if (existing) {
        existing.count++;
        existing.duplicates.push(event);
      } else {
        seen.set(key, { event, count: 1, duplicates: [] });
        result.push({ ...event, _duplicateKey: key });
      }
    }
    
    // Обновляем счетчики дублей и сохраняем дубликаты
    for (const [key, data] of seen.entries()) {
      if (data.count > 1) {
        const eventInResult = result.find(e => e._duplicateKey === key);
        if (eventInResult) {
          eventInResult._duplicateCount = data.count;
          eventInResult._duplicates = data.duplicates;
        }
      }
    }
    
    return result;
  }, [events]);

  // Apply all filters
  const filteredEvents = deduplicatedEvents.filter((event) => {
      // Selected hour filter (if user clicked on timeline chart)
      if (selectedHour) {
        const eventTime = new Date(event.ts).getTime();
        const hourStart = selectedHour;
        const hourEnd = selectedHour + 60 * 60 * 1000; // +1 hour
        if (eventTime < hourStart || eventTime >= hourEnd) {
          return false;
        }
      } else {
        // Time range filter (only if no specific hour selected)
        if (timeRange) {
          const eventTime = new Date(event.ts);
          const cutoff = new Date(Date.now() - timeRange * 60 * 60 * 1000);
          if (eventTime < cutoff) {
            return false;
          }
        }
      }
      
      // Text filter
      if (filter) {
        const interpretation = interpretEvent(event).toLowerCase();
        const filterLower = filter.toLowerCase();
        const serviceName = (event.service || event.target || '').toLowerCase();
        const matchesText = 
          interpretation.includes(filterLower) ||
          event.type.toLowerCase().includes(filterLower) ||
          event.action?.toLowerCase().includes(filterLower) ||
          event.email?.toLowerCase().includes(filterLower) ||
          serviceName.includes(filterLower);
        
        if (!matchesText) return false;
      }
      
      // Type filter
      if (typeFilter !== 'ALL' && event.type !== typeFilter) {
        return false;
      }
      
      // Severity filter
      if (severityFilter !== 'ALL' && event.severity !== severityFilter) {
        return false;
      }
      
      return true;
    });

  // Expose filtered events to parent component
  useEffect(() => {
    if (onFilteredEventsChange) {
      onFilteredEventsChange(filteredEvents);
    }
  }, [filteredEvents, onFilteredEventsChange]);

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'ERROR':
        return 'destructive';
      case 'WARN':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Сортировка
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'time':
          aValue = new Date(a.ts).getTime();
          bValue = new Date(b.ts).getTime();
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'severity':
          const severityOrder = { 'ERROR': 3, 'WARN': 2, 'INFO': 1 };
          aValue = severityOrder[a.severity as keyof typeof severityOrder] || 0;
          bValue = severityOrder[b.severity as keyof typeof severityOrder] || 0;
          break;
        case 'service':
          aValue = (a.service || a.target || '').toLowerCase();
          bValue = (b.service || b.target || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredEvents, sortField, sortDirection]);

  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const totalPages = Math.ceil(sortedEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEvents = sortedEvents.slice(startIndex, endIndex);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page on sort
  };
  
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  // Сброс страницы при изменении фильтров или сортировки
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, typeFilter, severityFilter, timeRange, selectedHour, sortField, sortDirection]);

  if (loading) {
    return (
      <Card className="p-6">
        <CardLoadingSpinner />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold">
            {lang === 'ru' ? 'События' : 'Events'}
          </h3>
          {sortedEvents.length > 0 && (
            <>
              <Badge variant="outline" className="text-xs">
                {sortedEvents.length} {lang === 'ru' ? 'всего' : 'total'}
              </Badge>
              {totalPages > 1 && (
                <Badge variant="secondary" className="text-xs">
                  {lang === 'ru' 
                    ? `Показано ${startIndex + 1}-${Math.min(endIndex, sortedEvents.length)}`
                    : `Showing ${startIndex + 1}-${Math.min(endIndex, sortedEvents.length)}`}
                </Badge>
              )}
            </>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {lang === 'ru' 
                ? `Страница ${currentPage} из ${totalPages}`
                : `Page ${currentPage} of ${totalPages}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[6rem] text-xs py-2">
              <button
                onClick={() => handleSort('time')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {lang === 'ru' ? 'Время' : 'Time'}
                {getSortIcon('time')}
              </button>
            </TableHead>
            <TableHead className="w-16 text-xs py-2">
              <button
                onClick={() => handleSort('type')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {lang === 'ru' ? 'Тип' : 'Type'}
                {getSortIcon('type')}
              </button>
            </TableHead>
            <TableHead className="w-[80px] text-xs py-2">
              <button
                onClick={() => handleSort('severity')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {lang === 'ru' ? 'Уровень' : 'Severity'}
                {getSortIcon('severity')}
              </button>
            </TableHead>
            <TableHead className="w-[120px] text-xs py-2">
              <button
                onClick={() => handleSort('service')}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {lang === 'ru' ? 'Сервис' : 'Service'}
                {getSortIcon('service')}
              </button>
            </TableHead>
            <TableHead className="text-xs py-2">{lang === 'ru' ? 'Описание' : 'Description'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEvents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                {lang === 'ru' ? 'Нет событий' : 'No events'}
              </TableCell>
            </TableRow>
          ) : (
            paginatedEvents.map((event, idx) => {
              const isError = event.severity === 'ERROR';
              const isWarn = event.severity === 'WARN';
              const duplicateCount = (event as any)._duplicateCount;
              const duplicates = (event as any)._duplicates as Event[] | undefined;
              const duplicateKey = (event as any)._duplicateKey as string | undefined;
              const isExpanded = duplicateKey ? expandedDuplicates.has(duplicateKey) : false;
              
              return (
                <>
                  <TableRow 
                    key={`${event.ts}-${event.type}-${event.action || ''}-${idx}`}
                    className={isError ? 'bg-red-50/50 dark:bg-red-950/10' : isWarn ? 'bg-yellow-50/50 dark:bg-yellow-950/10' : ''}
                  >
                    <TableCell className="font-mono text-xs py-2" title={new Date(event.ts).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}>
                      {formatEventTime(event.ts, timeRange, lang, true)}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        <EventIcon type={event.type} action={event.action} />
                        <span className="text-xs">{event.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant={getSeverityVariant(event.severity)} className="text-xs px-1.5 py-0">
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <button
                        onClick={() => {
                          const service = event.service || event.target;
                          if (service && onServiceClick) {
                            onServiceClick(service);
                          }
                        }}
                        className={`flex items-center gap-1.5 hover:opacity-80 transition-opacity ${
                          event.service || event.target ? 'cursor-pointer' : 'cursor-default'
                        }`}
                        disabled={!event.service && !event.target}
                      >
                        <ServiceIcon service={event.service || event.target || 'Unknown'} />
                        <span className="text-xs truncate max-w-[100px]" title={event.service || event.target || 'Unknown'}>
                          {event.service || event.target || (lang === 'ru' ? 'Неизвестно' : 'Unknown')}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-md">{interpretEvent(event)}</span>
                        {duplicateCount && duplicateCount > 1 && (
                          <button
                            onClick={() => {
                              if (duplicateKey) {
                                const newExpanded = new Set(expandedDuplicates);
                                if (isExpanded) {
                                  newExpanded.delete(duplicateKey);
                                } else {
                                  newExpanded.add(duplicateKey);
                                }
                                setExpandedDuplicates(newExpanded);
                              }
                            }}
                            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                          >
                            <Badge variant="outline" className="text-xs shrink-0">
                              {duplicateCount}x
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Развернутые дубликаты */}
                  {isExpanded && duplicates && duplicates.length > 0 && duplicates.map((duplicate, dupIdx) => (
                    <TableRow 
                      key={`duplicate-${duplicateKey}-${dupIdx}`}
                      className={`${isError ? 'bg-red-50/30 dark:bg-red-950/5' : isWarn ? 'bg-yellow-50/30 dark:bg-yellow-950/5' : 'bg-muted/20'} border-l-2 border-muted`}
                    >
                      <TableCell className="font-mono text-xs py-2 pl-6" title={new Date(duplicate.ts).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}>
                        {formatEventTime(duplicate.ts, timeRange, lang, true)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1.5">
                          <EventIcon type={duplicate.type} action={duplicate.action} />
                          <span className="text-xs">{duplicate.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={getSeverityVariant(duplicate.severity)} className="text-xs px-1.5 py-0">
                          {duplicate.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1.5">
                          <ServiceIcon service={duplicate.service || duplicate.target || 'Unknown'} />
                          <span className="text-xs truncate max-w-[100px]" title={duplicate.service || duplicate.target || 'Unknown'}>
                            {duplicate.service || duplicate.target || (lang === 'ru' ? 'Неизвестно' : 'Unknown')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        <span className="truncate max-w-md">{interpretEvent(duplicate)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
