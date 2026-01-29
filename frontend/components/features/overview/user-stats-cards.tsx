'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Globe, TrendingUp, TrendingDown, Smartphone, Wifi } from 'lucide-react';
import { ResponsiveLine } from '@nivo/line';
import { formatBytes, calculateChange } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAppStore } from '@/lib/store';
import { useDashboard, useLiveNow } from '@/lib/swr';
import { apiClient } from '@/lib/api';

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
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [mounted, setMounted] = useState(false);
  const [userStatuses, setUserStatuses] = useState<Map<string, string>>(new Map());
  const lang = useAppStore((state) => state.lang);

  // Use SWR for data fetching
  const { data: dashboardData, isLoading: loading } = useDashboard(14);
  const { data: liveData } = useLiveNow();

  // Ensure component is mounted before accessing store
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load user statuses from API
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const response = await apiClient.getUserStats();
        if (response.data?.ok && response.data.users) {
          const statusMap = new Map<string, string>();
          response.data.users.forEach((user: any) => {
            if (user.email && user.userStatus) {
              statusMap.set(user.email, user.userStatus);
            }
          });
          setUserStatuses(statusMap);
        }
      } catch (error) {
        console.error("Failed to load user statuses:", error);
      }
    };
    loadStatuses();
  }, []);

  // Process dashboard data into users list
  const users = useMemo<UserStatsCard[]>(() => {
    if (!dashboardData?.ok) return [];

    const usersData = dashboardData.users || {};
    const usersList = Object.keys(usersData)
      .filter(email => email && usersData[email])
      .map(email => {
        const userData = usersData[email];
        if (!userData) return null;
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
      })
      .filter((user): user is UserStatsCard => user !== null);

    usersList.sort((a, b) => b.sum7_traffic_bytes - a.sum7_traffic_bytes);
    return usersList;
  }, [dashboardData]);

  // Process online users from live data
  const onlineUsers = useMemo<Set<string>>(() => {
    const onlineSet = new Set<string>();
    const onlineUsersList = liveData?.now?.onlineUsers || [];

    onlineUsersList.forEach((user: string) => {
      onlineSet.add(user);
    });

    // Match with our users list to add both email and uuid for each online user
    users.forEach(u => {
      if (onlineSet.has(u.email) || onlineSet.has(u.uuid)) {
        onlineSet.add(u.email);
        onlineSet.add(u.uuid);
      }
    });

    return onlineSet;
  }, [liveData, users]);

  // Get device counts and quality info from live data
  const userDevices = useMemo(() => {
    return liveData?.now?.userDevices || {};
  }, [liveData]);

  const userQuality = useMemo(() => {
    return liveData?.now?.userQuality || {};
  }, [liveData]);

  // Get device count for a user
  const getUserDeviceCount = useCallback((user: UserStatsCard): number => {
    return userDevices[user.email] || userDevices[user.uuid] || 0;
  }, [userDevices]);

  // Get quality info for a user
  const getUserQualityInfo = useCallback((user: UserStatsCard) => {
    return userQuality[user.email] || userQuality[user.uuid] || null;
  }, [userQuality]);

  // Get quality color based on score
  const getQualityColor = useCallback((score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }, []);

  const formatConns = useCallback((conns: number): string => {
    if (conns >= 1000) {
      return `${(conns / 1000).toFixed(0)} тыс.`;
    }
    return conns.toString();
  }, []);

  const getChartData = useCallback((user: UserStatsCard) => {
    // Get all traffic data and take only the last 7 days
    const allTrafficData = user.daily_traffic_bytes || [];
    const trafficData = allTrafficData.slice(-7);

    // If empty, return minimal data to prevent chart rendering issues
    if (trafficData.length === 0) {
      return [{
        id: 'traffic',
        data: Array.from({ length: 7 }, (_, i) => ({ x: i + 1, y: 0 })),
      }];
    }

    // Pad with zeros at the beginning if we have less than 7 days
    const paddedData = trafficData.length < 7
      ? [...Array(7 - trafficData.length).fill(0), ...trafficData]
      : trafficData;

    return [{
      id: 'traffic',
      data: paddedData.map((bytes, index) => ({
        x: index + 1,
        y: bytes / 1024 / 1024 / 1024,
      })),
    }];
  }, []);

  const filteredUsers = useMemo(() => {
    if (!mounted) return [];
    return selectedUser === 'all' 
      ? users 
      : users.filter(u => u.uuid === selectedUser);
  }, [users, selectedUser, mounted]);

  const getUserStatus = useCallback((user: UserStatsCard): string => {
    const status = userStatuses.get(user.email) || userStatuses.get(user.uuid);
    return status || "offline";
  }, [userStatuses]);

  const isUserOnline = useCallback((user: UserStatsCard): boolean => {
    const status = getUserStatus(user);
    return status === "online" || status === "recent";
  }, [getUserStatus]);

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

      {/* User Cards Grid - single column on mobile */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {filteredUsers.map((user) => {
          const trafficChange = calculateChange(user.sum7_traffic_bytes, user.sum_prev7_traffic_bytes);
          const connsChange = calculateChange(user.sum7_conns, user.sum_prev7_conns);
          
          return (
            <Card key={user.uuid} className="p-3 hover:shadow-md transition-shadow flex flex-col">
              {/* User Header */}
              <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                <h4 className="font-semibold text-sm truncate min-w-0 flex-1">{user.alias || user.email}</h4>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Quality Indicator */}
                  {getUserQualityInfo(user) && (
                    <Badge
                      variant="outline"
                      className={`h-5 px-1.5 text-[10px] font-medium border-0 ${
                        getUserQualityInfo(user)!.quality >= 80
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                          : getUserQualityInfo(user)!.quality >= 50
                            ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                            : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}
                      title={`${lang === 'ru' ? 'Качество' : 'Quality'}: ${getUserQualityInfo(user)!.quality}%, ${lang === 'ru' ? 'разрывов' : 'disconnects'}: ${getUserQualityInfo(user)!.disconnects}`}
                    >
                      <Wifi className="w-2.5 h-2.5 mr-0.5" />
                      {getUserQualityInfo(user)!.quality}%
                    </Badge>
                  )}
                  {/* Online Status Badge */}
                  <Badge
                    variant="outline"
                    className={`h-5 px-1.5 text-[10px] font-medium ${
                      getUserStatus(user) === "online"
                        ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30'
                        : getUserStatus(user) === "recent"
                        ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
                        : 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30'
                    }`}
                  >
                    {getUserStatus(user) === "online" ? (
                      <>
                        {getUserDeviceCount(user) > 1 && (
                          <Smartphone className="w-2.5 h-2.5 mr-0.5" />
                        )}
                        {lang === 'ru' ? 'Онлайн' : 'Online'}
                        {getUserDeviceCount(user) > 1 && ` (${getUserDeviceCount(user)})`}
                      </>
                    ) : getUserStatus(user) === "recent" ? (
                      lang === 'ru' ? 'Недавно' : 'Recent'
                    ) : (
                      lang === 'ru' ? 'Офлайн' : 'Offline'
                    )}
                  </Badge>
                </div>
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
                <ResponsiveLine
                  data={getChartData(user)}
                  margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                  xScale={{ type: 'linear', min: 1, max: 7 }}
                  yScale={{ type: 'linear', min: 0, max: 'auto' }}
                  curve="monotoneX"
                  enableArea={true}
                  areaOpacity={0.3}
                  lineWidth={2}
                  colors={['#3b82f6']}
                  enablePoints={false}
                  enableGridX={false}
                  enableGridY={false}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={null}
                  axisLeft={null}
                  animate={false}
                  isInteractive={true}
                  useMesh={true}
                  tooltip={({ point }) => (
                    <div
                      style={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '10px',
                        padding: '4px 8px',
                      }}
                    >
                      {typeof point.data.y === 'number' ? point.data.y.toFixed(2) : point.data.y} GB
                    </div>
                  )}
                />
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
