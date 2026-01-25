'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { EventsTable } from '@/components/features/events/events-table';
import { EventsStatsSidebar } from '@/components/features/events/events-stats-sidebar';
import { EventsTimeline } from '@/components/features/events/events-timeline';
import { EventsCriticalAlerts } from '@/components/features/events/events-critical-alerts';
import { EventsTrendAndRepeated } from '@/components/features/events/events-trend-and-repeated';
import { EventsProblematicServices } from '@/components/features/events/events-problematic-services';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import type { EventType, EventSeverity, Event } from '@/types';
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
  const [selectedHour, setSelectedHour] = useState<number | undefined>(undefined);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string>('');
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
    { value: 720, label: '30d', labelRu: '30д' },
  ];

  const clearFilters = () => {
    setFilter('');
    setTypeFilter('ALL');
    setSeverityFilter('ALL');
    setSelectedHour(undefined);
    setServiceFilter('');
  };

  const hasActiveFilters = filter !== '' || typeFilter !== 'ALL' || severityFilter !== 'ALL' || selectedHour !== undefined || serviceFilter !== '';

  const exportEvents = () => {
    if (filteredEvents.length === 0) {
      toast.error(lang === 'ru' ? 'Нет событий для экспорта' : 'No events to export');
      return;
    }

    // CSV формат
    const headers = ['Time', 'Type', 'Severity', 'Service', 'Action', 'Message'];
    const rows = filteredEvents.map(event => [
      new Date(event.ts).toISOString(),
      event.type,
      event.severity,
      event.service || event.target || (lang === 'ru' ? 'Неизвестно' : 'Unknown'),
      event.action || '',
      event.message || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `events_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="p-4 space-y-3">
            {/* Title and Time Range */}
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
                    onClick={() => {
                      setTimeRange(range.value);
                      setSelectedHour(undefined); // Clear hour selection when changing range
                    }}
                  >
                    {lang === 'ru' ? range.labelRu : range.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Search and Filters */}
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

              {/* Export Button */}
              {filteredEvents.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportEvents}>
                  <Download className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Экспорт' : 'Export'}
                </Button>
              )}

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Сбросить' : 'Clear'}
                </Button>
              )}
            </div>

            {/* Active Filters Chips */}
            {(typeFilter !== 'ALL' || severityFilter !== 'ALL' || selectedHour || serviceFilter) && (
              <div className="flex flex-wrap gap-2">
                {typeFilter !== 'ALL' && (
                  <Badge variant="secondary" className="text-xs">
                    {lang === 'ru' ? 'Тип' : 'Type'}: {typeFilter}
                  </Badge>
                )}
                {severityFilter !== 'ALL' && (
                  <Badge variant="secondary" className="text-xs">
                    {lang === 'ru' ? 'Уровень' : 'Severity'}: {severityFilter}
                  </Badge>
                )}
                {serviceFilter && (
                  <Badge variant="secondary" className="text-xs">
                    {lang === 'ru' ? 'Сервис' : 'Service'}: {serviceFilter}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 -mr-1"
                      onClick={() => {
                        setServiceFilter('');
                        if (filter === serviceFilter) {
                          setFilter('');
                        }
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                )}
                {selectedHour && (
                  <Badge variant="secondary" className="text-xs">
                    {lang === 'ru' ? 'Час' : 'Hour'}: {new Date(selectedHour).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit' })}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 -mr-1"
                      onClick={() => setSelectedHour(undefined)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-auto p-4 space-y-3 min-w-0">
            {/* Критичные алерты - всегда видно первым */}
            {filteredEvents.length > 0 && (
              <EventsCriticalAlerts 
                events={filteredEvents}
                onFilterByService={(service) => {
                  setFilter(service);
                }}
                onFilterByType={(type) => {
                  setSeverityFilter(type as EventSeverity);
                }}
              />
            )}

            {/* Timeline Chart - компактный */}
            <EventsTimeline 
              hours={timeRange}
              typeFilter={typeFilter}
              severityFilter={severityFilter}
              onHourClick={(timestamp) => {
                setSelectedHour(timestamp);
              }}
              selectedHour={selectedHour}
            />

            {/* Две колонки: Тренд+Повторяющиеся слева, Проблемные сервисы справа */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Левая колонка: Тренд + Повторяющиеся проблемы */}
              <div className="space-y-3">
                <EventsTrendAndRepeated events={filteredEvents} />
              </div>

              {/* Правая колонка: Проблемные сервисы */}
              <div className="space-y-3">
                <EventsProblematicServices 
                  events={filteredEvents}
                  onFilterByService={(service) => {
                    setFilter(service);
                  }}
                />
              </div>
            </div>

            {/* Events Table */}
            <EventsTable 
              filter={filter}
              typeFilter={typeFilter}
              severityFilter={severityFilter}
              timeRange={timeRange}
              selectedHour={selectedHour}
              onFilteredEventsChange={setFilteredEvents}
            />
          </div>

          {/* Right Sidebar - Statistics */}
          <div className="hidden lg:block w-72 border-l bg-muted/30 overflow-auto">
            <div className="sticky top-0 p-4">
              <h2 className="text-sm font-semibold mb-4">
                {lang === 'ru' ? 'Статистика' : 'Statistics'}
              </h2>
              <EventsStatsSidebar hours={timeRange} />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
