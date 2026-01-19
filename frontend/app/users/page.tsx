'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { UsersTable } from '@/components/features/users/users-table';
import { AddUserDialog } from '@/components/features/users/add-user-dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Users, Activity, AlertTriangle, Zap } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { UserFilter } from '@/types';

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<UserFilter>('active');
  const [filterCounts, setFilterCounts] = useState<Record<UserFilter, number>>({
    all: 0,
    active: 0,
    'low-activity': 0,
    online: 0,
  });
  const { lang } = useAppStore();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {lang === 'ru' ? 'Пользователи' : 'Users'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {lang === 'ru' 
                ? 'Управление пользователями и доступом' 
                : 'Manage user accounts and access'}
            </p>
          </div>
          
          <AddUserDialog />
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={lang === 'ru' ? 'Поиск по email или имени...' : 'Search by email or name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as UserFilter)}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="all" className="gap-2 flex-col sm:flex-row py-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ru' ? 'Все' : 'All'}</span>
              </div>
              {filterCounts.all > 0 && (
                <span className="text-xs text-muted-foreground">({filterCounts.all})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2 flex-col sm:flex-row py-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ru' ? 'Активные' : 'Active'}</span>
              </div>
              {filterCounts.active > 0 && (
                <span className="text-xs text-muted-foreground">({filterCounts.active})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="low-activity" className="gap-2 flex-col sm:flex-row py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ru' ? 'Низкая активность' : 'Low Activity'}</span>
              </div>
              {filterCounts['low-activity'] > 0 && (
                <span className="text-xs text-muted-foreground">({filterCounts['low-activity']})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="online" className="gap-2 flex-col sm:flex-row py-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ru' ? 'Онлайн' : 'Online'}</span>
              </div>
              {filterCounts.online > 0 && (
                <span className="text-xs text-muted-foreground">({filterCounts.online})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <UsersTable 
          searchQuery={searchQuery} 
          filter={activeFilter}
          onFilterCountsChange={setFilterCounts}
        />
      </div>
    </MainLayout>
  );
}
