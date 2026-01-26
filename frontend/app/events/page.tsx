'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { EventsTable } from '@/components/features/events/events-table';
import { EventsStatsSidebar } from '@/components/features/events/events-stats-sidebar';
import { EventsMiniTimeline } from '@/components/features/events/events-mini-timeline';
import { EventsAlertsPanel } from '@/components/features/events/events-alerts-panel';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter, Download, ChevronDown } from 'lucide-react';
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
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

export default function EventsPage() {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<EventType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'ALL'>('ALL');
  const [timeRange, setTimeRange] = useState<number>(24);
  const [selectedHour, setSelectedHour] = useState<number | undefined>(undefined);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const { lang } = useAppStore();

  const eventTypes: Array<{ value: EventType | 'ALL'; label: string; labelRu: string }> = [
    { value: 'ALL', label: 'All Types', labelRu: 'Все типы' },
    { value: 'USER', label: 'User', labelRu: 'Пользователи' },
    { value: 'SYSTEM', label: 'System', labelRu: 'Система' },
    { value: 'CONNECTION', label: 'Connection', labelRu: 'Подключения' },
    { value: 'SERVICE_HEALTH', label: 'Service Health', labelRu: 'Здоровье сервисов' },
    { value: 'APP_ERROR', label: 'App Error', labelRu: 'Ошибки' },
    { value: 'XRAY', label: 'Xray', labelRu: 'Xray' },
    { value: 'SETTINGS', label: 'Settings', labelRu: 'Настройки' },
    { value: 'COLLECTOR', label: 'Collector', labelRu: 'Сборщик' },
    { value: 'PERFORMANCE', label: 'Performance', labelRu: 'Производительность' },
    { value: 'UPDATE', label: 'Update', labelRu: 'Обновления' },
  ];

  const severityLevels: Array<{ value: EventSeverity | 'ALL'; label: string; labelRu: string }> = [
    { value: 'ALL', label: 'All Levels', labelRu: 'Все уровни' },
    { value: 'ERROR', label: 'Error', labelRu: 'Ошибки' },
    { value: 'WARN', label: 'Warning', labelRu: 'Предупр.' },
    { value: 'INFO', label: 'Info', labelRu: 'Инфо' },
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
    setSelectedHour(undefined);
  };

  const hasActiveFilters = filter !== '' || typeFilter !== 'ALL' || severityFilter !== 'ALL' || selectedHour !== undefined;

  const exportEvents = () => {
    if (filteredEvents.length === 0) {
      toast.error(lang === 'ru' ? 'Нет событий для экспорта' : 'No events to export');
      return;
    }

    const headers = ['Time', 'Type', 'Severity', 'Service', 'Action', 'Message'];
    const rows = filteredEvents.map(event => [
      new Date(event.ts).toISOString(),
      event.type,
      event.severity,
      event.service || event.target || '',
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
      <div className="flex flex-col h-full min-h-0">
        {/* Compact Header - 48px */}
        <div className="shrink-0 h-12 flex items-center justify-between px-3 border-b bg-background">
          {/* Left: Title + Time Range */}
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold">
              {lang === 'ru' ? 'События' : 'Events'}
            </h1>

            {/* Inline Time Range Buttons */}
            <div className="flex items-center gap-1">
              {timeRanges.map((range) => (
                <Button
                  key={range.value}
                  variant={timeRange === range.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setTimeRange(range.value);
                    setSelectedHour(undefined);
                  }}
                >
                  {lang === 'ru' ? range.labelRu : range.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Right: Search + Filters + Export */}
          <div className="flex items-center gap-2">
            {/* Compact Search */}
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={lang === 'ru' ? 'Поиск...' : 'Search...'}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-7 pl-7 pr-7 text-xs"
              />
              {filter && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={() => setFilter('')}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Combined Filters Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                  <Filter className="w-3 h-3 mr-1" />
                  {lang === 'ru' ? 'Фильтры' : 'Filters'}
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {[typeFilter !== 'ALL', severityFilter !== 'ALL', selectedHour].filter(Boolean).length}
                    </Badge>
                  )}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">
                  {lang === 'ru' ? 'Тип события' : 'Event Type'}
                </DropdownMenuLabel>
                {eventTypes.slice(0, 6).map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type.value}
                    checked={typeFilter === type.value}
                    onCheckedChange={() => setTypeFilter(type.value)}
                    className="text-xs"
                  >
                    {lang === 'ru' ? type.labelRu : type.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">
                  {lang === 'ru' ? 'Уровень' : 'Severity'}
                </DropdownMenuLabel>
                {severityLevels.map((level) => (
                  <DropdownMenuCheckboxItem
                    key={level.value}
                    checked={severityFilter === level.value}
                    onCheckedChange={() => setSeverityFilter(level.value)}
                    className="text-xs"
                  >
                    {lang === 'ru' ? level.labelRu : level.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearFilters} className="text-xs text-red-600">
                      <X className="w-3 h-3 mr-1" />
                      {lang === 'ru' ? 'Сбросить всё' : 'Clear all'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={exportEvents}
              disabled={filteredEvents.length === 0}
            >
              <Download className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-auto p-3 gap-2">
            {/* Alerts Panel - shows status and actionable problems */}
            <EventsAlertsPanel
              events={filteredEvents}
              onFilter={(type, value) => {
                if (type === 'severity') {
                  setSeverityFilter(value as EventSeverity);
                } else if (type === 'search') {
                  setFilter(value);
                } else if (type === 'type') {
                  setTypeFilter(value as EventType);
                }
              }}
            />

            {/* Mini Timeline - 60px */}
            <EventsMiniTimeline
              hours={timeRange}
              onHourClick={(timestamp) => setSelectedHour(timestamp)}
              selectedHour={selectedHour}
            />

            {/* Events Table - flex-1 */}
            <div className="flex-1 min-h-0">
              <EventsTable
                filter={filter}
                typeFilter={typeFilter}
                severityFilter={severityFilter}
                timeRange={timeRange}
                selectedHour={selectedHour}
                onFilteredEventsChange={setFilteredEvents}
                onServiceClick={(service) => setFilter(service)}
              />
            </div>
          </div>

          {/* Right Sidebar - 240px */}
          <div className="hidden lg:block w-60 border-l bg-muted/30 p-3 overflow-auto">
            <EventsStatsSidebar
              hours={timeRange}
              events={filteredEvents}
              onTypeClick={(type) => setTypeFilter(type as EventType)}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
