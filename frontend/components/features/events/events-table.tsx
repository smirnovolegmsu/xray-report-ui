'use client';

import { useEffect, useState } from 'react';
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
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import type { Event, EventType, EventSeverity } from '@/types';
import { EventIcon } from './event-icon';

interface EventsTableProps {
  filter?: string;
  typeFilter?: EventType | 'ALL';
  severityFilter?: EventSeverity | 'ALL';
}

export function EventsTable({ 
  filter: externalFilter,
  typeFilter = 'ALL',
  severityFilter = 'ALL'
}: EventsTableProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();
  
  // Use external filter if provided, otherwise empty string
  const filter = externalFilter || '';

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadEvents = async () => {
    try {
      const response = await apiClient.getEvents({ limit: 100 });
      setEvents(response.data.events || []);
      setLoading(false);
    } catch (error) {
      if (loading) {
        toast.error(handleApiError(error));
      }
      setLoading(false);
    }
  };

  const interpretEvent = (event: Event): string => {
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
  };

  // Apply all filters
  const filteredEvents = events.filter((event) => {
    // Text filter
    if (filter) {
      const interpretation = interpretEvent(event).toLowerCase();
      const filterLower = filter.toLowerCase();
      const matchesText = 
        interpretation.includes(filterLower) ||
        event.type.toLowerCase().includes(filterLower) ||
        event.action?.toLowerCase().includes(filterLower) ||
        event.email?.toLowerCase().includes(filterLower);
      
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

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">
              {lang === 'ru' ? 'Время' : 'Time'}
            </TableHead>
            <TableHead className="w-[80px]">
              {lang === 'ru' ? 'Тип' : 'Type'}
            </TableHead>
            <TableHead className="w-[100px]">
              {lang === 'ru' ? 'Уровень' : 'Severity'}
            </TableHead>
            <TableHead>{lang === 'ru' ? 'Описание' : 'Description'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredEvents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                {lang === 'ru' ? 'Нет событий' : 'No events'}
              </TableCell>
            </TableRow>
          ) : (
            filteredEvents.map((event, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono text-xs">
                  {new Date(event.ts).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <EventIcon type={event.type} action={event.action} />
                    <span className="text-xs font-medium">{event.type}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getSeverityVariant(event.severity)} className="text-xs">
                    {event.severity}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {interpretEvent(event)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
