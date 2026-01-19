'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { EventsTable } from '@/components/features/events/events-table';
import { EventsStats } from '@/components/features/events/events-stats';
import { EventsTimeline } from '@/components/features/events/events-timeline';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import type { EventType, EventSeverity } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function EventsPage() {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<EventType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'ALL'>('ALL');
  const [timeRange, setTimeRange] = useState<number>(24);
  const { lang } = useAppStore();

  const eventTypes: Array<{ value: EventType | 'ALL'; label: string; labelRu: string }> = [
    { value: 'ALL', label: 'All Types', labelRu: 'Все типы' },
    { value: 'USER', label: 'User', labelRu: 'Пользователи' },
    { value: 'SYSTEM', label: 'System', labelRu: 'Система' },
    { value: 'CONNECTION', label: 'Connection', labelRu: 'Подключения' },
    { value: 'SERVICE_HEALTH', label: 'Service Health', labelRu: 'Здоровье сервисов' },
    { value: 'APP_ERROR', label: 'App Error', labelRu: 'Ошибки приложения' },
    { value: 'XRAY', label: 'Xray', labelRu: 'Xray' },
    { value: 'SETTINGS', label: 'Settings', labelRu: 'Настройки' },
    { value: 'COLLECTOR', label: 'Collector', labelRu: 'Сборщик' },
    { value: 'PERFORMANCE', label: 'Performance', labelRu: 'Производительность' },
    { value: 'UPDATE', label: 'Update', labelRu: 'Обновления' },
  ];

  const severityLevels: Array<{ value: EventSeverity | 'ALL'; label: string; labelRu: string }> = [
    { value: 'ALL', label: 'All Levels', labelRu: 'Все уровни' },
    { value: 'ERROR', label: 'Error', labelRu: 'Ошибки' },
    { value: 'WARN', label: 'Warning', labelRu: 'Предупреждения' },
    { value: 'INFO', label: 'Info', labelRu: 'Информация' },
  ];

  const timeRanges = [
    { value: 1, label: '1h', labelRu: '1ч' },
    { value: 6, label: '6h', labelRu: '6ч' },
    { value: 24, label: '24h', labelRu: '24ч' },
    { value: 168, label: '7d', labelRu: '7д' },
  ];

  const clearFilters = () => {
    setFilter('');
    setTypeFilter('ALL');
    setSeverityFilter('ALL');
  };

  const hasActiveFilters = filter !== '' || typeFilter !== 'ALL' || severityFilter !== 'ALL';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {lang === 'ru' ? 'События' : 'Events'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === 'ru' 
                ? 'Журнал системных событий и активности пользователей'
                : 'System and user activity logs'
              }
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            {timeRanges.map((range) => (
              <Button
                key={range.value}
                variant={timeRange === range.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range.value)}
              >
                {lang === 'ru' ? range.labelRu : range.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Statistics Dashboard */}
        <EventsStats hours={timeRange} />

        {/* Timeline Chart */}
        <EventsTimeline hours={timeRange} />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Text Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={lang === 'ru' ? 'Поиск событий...' : 'Search events...'}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-10"
            />
            {filter && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={() => setFilter('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Тип' : 'Type'}
                {typeFilter !== 'ALL' && (
                  <Badge variant="secondary" className="ml-2">
                    {typeFilter}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {lang === 'ru' ? 'Тип события' : 'Event Type'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {eventTypes.map((type) => (
                <DropdownMenuItem
                  key={type.value}
                  onClick={() => setTypeFilter(type.value)}
                  className={typeFilter === type.value ? 'bg-accent' : ''}
                >
                  {lang === 'ru' ? type.labelRu : type.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Severity Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Уровень' : 'Severity'}
                {severityFilter !== 'ALL' && (
                  <Badge variant="secondary" className="ml-2">
                    {severityFilter}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>
                {lang === 'ru' ? 'Уровень важности' : 'Severity Level'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {severityLevels.map((level) => (
                <DropdownMenuItem
                  key={level.value}
                  onClick={() => setSeverityFilter(level.value)}
                  className={severityFilter === level.value ? 'bg-accent' : ''}
                >
                  {lang === 'ru' ? level.labelRu : level.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Сбросить' : 'Clear'}
            </Button>
          )}
        </div>

        {/* Events Table */}
        <EventsTable 
          filter={filter}
          typeFilter={typeFilter}
          severityFilter={severityFilter}
        />
      </div>
    </MainLayout>
  );
}
