'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Globe, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { handleApiError, formatBytes, calculateChange, devLog } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import { LoadingSpinner, CardLoadingSpinner } from '@/components/ui/loading-spinner';
import { useAppStore } from '@/lib/store';
import type { DashboardApiResponse } from '@/types';

interface UserStatsCard {
  uuid: string;
  email: string;
  alias: string;
  anomaly: boolean;
  sum7_traffic_bytes: number;
  sum7_conns: number;
  sum_prev7_traffic_bytes: number;
  sum_prev7_conns: number;
  daily_traffic_bytes: number[];
  daily_conns: number[];
  top_domains_traffic: Array<{
    domain: string;
    value: number;
    pct: number;
  }>;
}

export function UserStatsCards() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserStatsCard[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const { lang } = useAppStore();
  const usersRef = useRef<UserStatsCard[]>([]);

  // Keep usersRef in sync with users
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const loadOnlineStatus = useCallback(async () => {
    try {
      const response = await apiClient.getLiveNow();
      const onlineUsersList = response.data?.now?.onlineUsers || [];
      // Create a set with both email and uuid for matching
      const onlineSet = new Set<string>();
      
      // Add all online users from API response
      onlineUsersList.forEach((user: string) => {
        onlineSet.add(user);
      });
      
      // Match with our users list to add both email and uuid for each online user
      usersRef.current.forEach(u => {
        if (onlineSet.has(u.email) || onlineSet.has(u.uuid)) {
          // If user is online, add both identifiers
          onlineSet.add(u.email);
          onlineSet.add(u.uuid);
        }
      });
      
      setOnlineUsers(onlineSet);
    } catch (error) {
      devLog.warn('Failed to load online status:', error);
    }
  }, []);

  const loadUserStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDashboard({ days: 14 });
      const data = response.data as DashboardApiResponse;
      
      const usersData = data.users || {};
      const usersList = Object.keys(usersData).map(email => {
        const userData = usersData[email];
        return {
          uuid: userData.uuid || email,
          email: userData.email || email,
          alias: userData.alias || '',
          anomaly: userData.anomaly || false,
          sum7_traffic_bytes: userData.sum7_traffic_bytes || 0,
          sum7_conns: userData.sum7_conns || 0,
          sum_prev7_traffic_bytes: userData.sum_prev7_traffic_bytes || 0,
          sum_prev7_conns: userData.sum_prev7_conns || 0,
          daily_traffic_bytes: userData.daily_traffic_bytes || [],
          daily_conns: userData.daily_conns || [],
          top_domains_traffic: userData.top_domains_traffic || [],
        };
      });
      
      usersList.sort((a, b) => b.sum7_traffic_bytes - a.sum7_traffic_bytes);
      setUsers(usersList);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserStats();
  }, [loadUserStats]);

  // Load online status when users are loaded, then update periodically
  useEffect(() => {
    if (users.length > 0) {
      loadOnlineStatus();
      // Update online status every 10 seconds
      const interval = setInterval(() => {
        loadOnlineStatus();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [users.length, loadOnlineStatus]);

  const formatConns = useCallback((conns: number): string => {
    if (conns >= 1000) {
      return `${(conns / 1000).toFixed(0)} тыс.`;
    }
    return conns.toString();
  }, []);

  const getChartData = useCallback((user: UserStatsCard) => {
    return user.daily_traffic_bytes.map((bytes, index) => ({
      day: index + 1,
      v: bytes / 1024 / 1024 / 1024,
    }));
  }, []);

  const filteredUsers = useMemo(() => {
    return selectedUser === 'all' 
      ? users 
      : users.filter(u => u.uuid === selectedUser);
  }, [users, selectedUser]);

  const isUserOnline = useCallback((user: UserStatsCard): boolean => {
    return onlineUsers.has(user.email) || onlineUsers.has(user.uuid);
  }, [onlineUsers]);

  if (loading) {
    return (
      <Card className="p-3">
        <LoadingSpinner size="sm" />
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">User Statistics</h3>
      </div>
      
      {/* User Filter */}
      <div className="flex flex-wrap gap-1">
        <Button
          variant={selectedUser === 'all' ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => setSelectedUser('all')}
        >
          All ({users.length})
        </Button>
        {users.map((user) => (
          <Button
            key={user.uuid}
            variant={selectedUser === user.uuid ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setSelectedUser(user.uuid)}
          >
            {user.alias || user.email}
          </Button>
        ))}
      </div>

      {/* User Cards Grid */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {filteredUsers.map((user) => {
          const trafficChange = calculateChange(user.sum7_traffic_bytes, user.sum_prev7_traffic_bytes);
          const connsChange = calculateChange(user.sum7_conns, user.sum_prev7_conns);
          
          return (
            <Card key={user.uuid} className="p-3 hover:shadow-md transition-shadow flex flex-col">
              {/* User Header */}
              <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                <h4 className="font-semibold text-sm truncate min-w-0 flex-1">{user.alias || user.email}</h4>
                <Badge 
                  variant="outline"
                  className={`h-5 px-1.5 text-[10px] font-medium shrink-0 ${
                    isUserOnline(user)
                      ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30'
                      : 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30'
                  }`}
                >
                  {isUserOnline(user) 
                    ? (lang === 'ru' ? 'Онлайн' : 'Online')
                    : (lang === 'ru' ? 'Офлайн' : 'Offline')
                  }
                </Badge>
              </div>

              {/* Stats Badges - using grid for alignment */}
              <div className="flex gap-2 mb-3">
                {/* Traffic Card */}
                <div className="flex-1 bg-muted/50 rounded-lg p-2 border border-border grid grid-rows-[16px_24px] gap-1">
                  {/* Row 1: Label + Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Traffic</span>
                    {trafficChange !== null && (
                      <Badge 
                        variant="outline"
                        className={`h-4 px-1 text-[10px] font-semibold gap-0.5 border-0 ${
                          trafficChange > 0 
                            ? 'bg-green-500/15 text-green-600 dark:text-green-400' 
                            : 'bg-red-500/15 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {trafficChange > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {Math.abs(Math.round(trafficChange))}%
                      </Badge>
                    )}
                  </div>
                  {/* Row 2: Value */}
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold leading-none">
                      <NumberFlow 
                        value={user.sum7_traffic_bytes / 1024 / 1024 / 1024} 
                        format={{ style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                        {...defaultNumberFlowConfig}
                      />
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">GB</span>
                  </div>
                </div>
                
                {/* Connections Card */}
                <div className="flex-1 bg-muted/50 rounded-lg p-2 border border-border grid grid-rows-[16px_24px] gap-1">
                  {/* Row 1: Label + Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Conns</span>
                    {connsChange !== null && (
                      <Badge 
                        variant="outline"
                        className={`h-4 px-1 text-[10px] font-semibold gap-0.5 border-0 ${
                          connsChange > 0 
                            ? 'bg-green-500/15 text-green-600 dark:text-green-400' 
                            : 'bg-red-500/15 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {connsChange > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {Math.abs(Math.round(connsChange))}%
                      </Badge>
                    )}
                  </div>
                  {/* Row 2: Value */}
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold leading-none">
                      {formatConns(user.sum7_conns)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mini Chart */}
              <div className="h-12 mb-2 relative overflow-hidden rounded-md bg-muted/30">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getChartData(user)} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <defs>
                      <linearGradient id={`gradient-${user.uuid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '10px',
                        padding: '4px 8px',
                      }}
                      formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(2)} GB`, ''] : ['', '']}
                      labelStyle={{ display: 'none' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="v" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fill={`url(#gradient-${user.uuid})`}
                      isAnimationActive={false}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top 5 Domains */}
              <div>
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <Globe className="w-3 h-3" />
                  <span>Top 5</span>
                </div>
                <div className="space-y-0.5">
                  {user.top_domains_traffic.slice(0, 5).map((domain, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 text-xs bg-muted/50 rounded px-1.5 py-0.5"
                    >
                      <span className="text-primary font-semibold w-7 shrink-0">
                        {domain.pct.toFixed(0)}%
                      </span>
                      <span className="text-muted-foreground font-medium w-14 shrink-0">
                        {formatBytes(domain.value, { compact: true }) as string}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="flex-1 truncate font-mono">
                        {domain.domain}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
