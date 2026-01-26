'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import type { DatesApiResponse } from '@/types';

interface DateSelectorProps {
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
}

export function DateSelector({ selectedDate, onDateChange }: DateSelectorProps) {
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDates();
  }, []);

  const loadDates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsageDates();
      const datesList = (response?.data as DatesApiResponse)?.dates || [];
      setDates(datesList);
      
      if (!selectedDate && datesList.length > 0) {
        onDateChange(null);
      }
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Last 7 days';

    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDisplayText = () => {
    if (!selectedDate) return '7 days';
    const date = new Date(selectedDate);
    return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  return (
    <Select
      value={selectedDate || 'current'}
      onValueChange={(value) => onDateChange(value === 'current' ? null : value)}
      disabled={loading}
    >
      <SelectTrigger className="w-auto h-8 text-xs px-2">
        <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground shrink-0" />
        <span>{getDisplayText()}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="current">Last 7 days</SelectItem>
        {dates.map((date) => (
          <SelectItem key={date} value={date}>
            {formatDate(date)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
