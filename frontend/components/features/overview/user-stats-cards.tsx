'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, Globe } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { defaultNumberFlowConfig } from '@/lib/number-flow-config';
import { motion } from 'framer-motion';

interface UserStats {
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
  prev_daily_traffic_bytes: number[];
  prev_daily_conns: number[];
  top_domains_traffic: Array<{
    domain: string;
    value: number;
    pct: number;
  }>;
  top_domains_conns: Array<{
    domain: string;
    value: number;
    pct: number;
  }>;
}

export function UserStatsCards() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDashboard({ days: 14 });
      const data = response.data as any;
      
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
          prev_daily_traffic_bytes: userData.prev_daily_traffic_bytes || [],
          prev_daily_conns: userData.prev_daily_conns || [],
          top_domains_traffic: userData.top_domains_traffic || [],
          top_domains_conns: userData.top_domains_conns || [],
        };
      });
      
      // Sort by traffic descending
      usersList.sort((a, b) => b.sum7_traffic_bytes - a.sum7_traffic_bytes);
      
      setUsers(usersList);
      setDates(data.meta?.days || []);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0.0 GB';
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb < 1) {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(1)} MB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  const formatConns = (conns: number): string => {
    if (conns >= 1000) {
      return `${(conns / 1000).toFixed(1)}k`;
    }
    return conns.toString();
  };

  const getChartData = (user: UserStats) => {
    return user.daily_traffic_bytes.map((bytes, index) => ({
      day: index + 1,
      traffic_gb: bytes / 1024 / 1024 / 1024,
    }));
  };

  const calculateChange = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const filteredUsers = selectedUser === 'all' 
    ? users 
    : users.filter(u => u.uuid === selectedUser);

  if (loading) {
    return (
      <Card className="p-3">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* User Filter with Checkboxes */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold">User Statistics</h3>
          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">
            {selectedUser === 'all' ? `${users.length} users` : `${filteredUsers.length} selected`}
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-1">
          <Button
            variant={selectedUser === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-[10px] px-2 min-h-[44px] sm:min-h-0 sm:h-7"
            onClick={() => setSelectedUser('all')}
          >
            All ({users.length})
          </Button>
          {users.map((user) => (
            <Button
              key={user.uuid}
              variant={selectedUser === user.uuid ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-[10px] px-2 min-h-[44px] sm:min-h-0 sm:h-7"
              onClick={() => setSelectedUser(user.uuid)}
            >
              {user.alias || user.email}
            </Button>
          ))}
        </div>
      </div>

      {/* User Cards Grid - Fully adaptive based on available width (200-270px per card) */}
      <div 
        className="grid gap-2"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 270px))',
        }}
      >
        {filteredUsers.map((user) => (
          <motion.div
            key={user.uuid}
            whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.99 }}
            className="container-user"
          >
            <Card className="p-2.5 hover:shadow-md transition-shadow">
              {/* User Header */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${user.anomaly ? 'bg-red-500' : 'bg-green-500'}`} />
                <h4 className="font-semibold text-xs truncate flex-1">{user.alias || user.email}</h4>
              </div>

              {/* Traffic & Connections Badges */}
              <div className="flex gap-1.5 mb-1.5">
                <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded p-1.5 border border-blue-200 dark:border-blue-800">
                  <div className="text-[9px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">
                    TRAFFIC
                  </div>
                  <div className="flex items-baseline gap-0.5 flex-wrap">
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                      <NumberFlow 
                        value={user.sum7_traffic_bytes / 1024 / 1024 / 1024} 
                        format={{ style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                        {...defaultNumberFlowConfig}
                        trend={(oldVal, newVal) => Math.sign(newVal - oldVal)}
                      />
                    </span>
                    <span className="text-[8px] text-blue-600 dark:text-blue-400">GB</span>
                    {(() => {
                      const change = calculateChange(user.sum7_traffic_bytes, user.sum_prev7_traffic_bytes);
                      if (change === null) return null;
                      return (
                        <span className={`text-[8px] font-medium ml-0.5 ${
                          change > 0 ? 'text-green-600 dark:text-green-400' : 
                          change < 0 ? 'text-red-600 dark:text-red-400' : 
                          'text-gray-500'
                        }`}>
                          {change > 0 ? '↑' : change < 0 ? '↓' : '='}{Math.abs(change).toFixed(0)}%
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded p-1.5 border border-green-200 dark:border-green-800">
                  <div className="text-[9px] text-green-600 dark:text-green-400 font-medium mb-0.5">
                    CONNS
                  </div>
                  <div className="flex items-baseline gap-0.5 flex-wrap">
                    <span className="text-sm font-bold text-green-700 dark:text-green-300">
                      <NumberFlow 
                        value={user.sum7_conns} 
                        format={{ notation: user.sum7_conns >= 1000 ? 'compact' : 'standard' }}
                        {...defaultNumberFlowConfig}
                        trend={(oldVal, newVal) => Math.sign(newVal - oldVal)}
                      />
                    </span>
                    {(() => {
                      const change = calculateChange(user.sum7_conns, user.sum_prev7_conns);
                      if (change === null) return null;
                      return (
                        <span className={`text-[8px] font-medium ml-0.5 ${
                          change > 0 ? 'text-green-600 dark:text-green-400' : 
                          change < 0 ? 'text-red-600 dark:text-red-400' : 
                          'text-gray-500'
                        }`}>
                          {change > 0 ? '↑' : change < 0 ? '↓' : '='}{Math.abs(change).toFixed(0)}%
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Mini Chart - Traffic over 7 days */}
              <div className="h-12 -mx-1 mb-1.5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getChartData(user)} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <defs>
                      <linearGradient id={`traffic-${user.uuid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="traffic_gb" 
                      stroke="#3b82f6" 
                      strokeWidth={1.5}
                      fill={`url(#traffic-${user.uuid})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top Domains - all visible */}
              <div>
                <div className="flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground mb-1">
                  <Globe className="w-2.5 h-2.5" />
                  <span>Top 5</span>
                </div>
                <div className="space-y-0.5">
                  {user.top_domains_traffic.slice(0, 5).map((domain, idx) => {
                    const connData = user.top_domains_conns?.find(d => d.domain === domain.domain);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-0.5 text-[8px] bg-muted/50 rounded px-1 py-0.5"
                      >
                        <span className="text-primary font-semibold w-7 shrink-0">
                          {domain.pct.toFixed(0)}%
                        </span>
                        <span className="text-muted-foreground font-medium text-[7px] shrink-0">
                          {formatBytes(domain.value)}
                        </span>
                        <span className="text-muted-foreground text-[6px]">•</span>
                        <span className="flex-1 truncate font-mono text-[7px]">
                          {domain.domain}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
          </Card>
        </motion.div>
        ))}
      </div>
    </div>
  );
}
