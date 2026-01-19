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
import type { Event } from '@/types';
import { EventIcon } from './event-icon';

interface EventsTableProps {
  filter?: string;
}

export function EventsTable({ filter: externalFilter }: EventsTableProps) {
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
      return lang === 'ru'
        ? `Действие с пользователем: ${action}`
        : `User action: ${action}`;
    }
    
    if (type === 'SYSTEM') {
      if (action.includes('restart')) {
        return lang === 'ru'
          ? `Перезапуск сервиса: ${event.target || '—'}`
          : `Service restart: ${event.target || '—'}`;
      }
      return lang === 'ru'
        ? `Системное действие: ${action}`
        : `System action: ${action}`;
    }
    
    if (type === 'SETTINGS') {
      return lang === 'ru'
        ? `Изменены настройки: ${action}`
        : `Settings changed: ${action}`;
    }
    
    if (type === 'XRAY') {
      return lang === 'ru'
        ? `Действие с Xray: ${action}`
        : `Xray action: ${action}`;
    }
    
    return event.message || action || '—';
  };

  const filteredEvents = filter
    ? events.filter((event) => {
        const interpretation = interpretEvent(event).toLowerCase();
        const filterLower = filter.toLowerCase();
        return (
          interpretation.includes(filterLower) ||
          event.type.toLowerCase().includes(filterLower) ||
          event.action?.toLowerCase().includes(filterLower) ||
          event.email?.toLowerCase().includes(filterLower)
        );
      })
    : events;

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
