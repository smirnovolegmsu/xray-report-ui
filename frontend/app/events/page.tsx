'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { EventsTable } from '@/components/features/events/events-table';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EventsPage() {
  const [filter, setFilter] = useState('');

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Events</h1>
            <p className="text-sm text-muted-foreground mt-1">
              System and user activity logs
            </p>
          </div>

          {/* Text Filter */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter events..."
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
        </div>

        <EventsTable filter={filter} />
      </div>
    </MainLayout>
  );
}
