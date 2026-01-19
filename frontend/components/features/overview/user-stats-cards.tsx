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
      const usersList = Object.keys(usersData).map(uuid => ({
        uuid,
        ...usersData[uuid]
      }));
      
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

  const calculateChange = (current: number, previous: number): { percent: number; isPositive: boolean } => {
    if (previous === 0) {
      return { percent: current > 0 ? 100 : 0, isPositive: current > 0 };
    }
    const change = ((current - previous) / previous) * 100;
    return { percent: Math.abs(change), isPositive: change >= 0 };
  };

  const getChartData = (user: UserStats) => {
    return dates.map((dateStr, index) => ({
      date: new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
      }),
      traffic_gb: user.daily_traffic_bytes[index] / 1024 / 1024 / 1024,
      conns: user.daily_conns[index],
    }));
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
            className="h-6 text-[10px] px-2"
            onClick={() => setSelectedUser('all')}
          >
            All ({users.length})
          </Button>
          {users.map((user) => (
            <Button
              key={user.uuid}
              variant={selectedUser === user.uuid ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setSelectedUser(user.uuid)}
            >
              {user.alias || user.email}
            </Button>
          ))}
        </div>
      </div>

      {/* User Cards Grid - More Compact */}
      <div className="grid gap-1.5 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {filteredUsers.map((user) => (
          <motion.div
            key={user.uuid}
            whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.99 }}
          >
            <Card className="p-2 space-y-1.5 hover:shadow-md transition-shadow">
              {/* User Header */}
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${user.anomaly ? 'bg-red-500' : 'bg-green-500'}`} />
              <h4 className="font-semibold text-[11px] truncate flex-1">{user.alias || user.email}</h4>
            </div>

            {/* Traffic & Connections Badges */}
            <div className="flex gap-1.5">
              <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded p-1.5 border border-blue-200 dark:border-blue-800">
                <div className="text-[9px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">
                  TRAFFIC
                </div>
                <div className="flex items-baseline gap-0.5">
                  <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    <NumberFlow 
                      value={user.sum7_traffic_bytes / 1024 / 1024 / 1024} 
                      format={{ style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                      {...defaultNumberFlowConfig}
                      trend={(oldVal, newVal) => Math.sign(newVal - oldVal)}
                    />
                    <span className="text-[8px] ml-0.5">GB</span>
                  </div>
                  {(() => {
                    const change = calculateChange(user.sum7_traffic_bytes, user.sum_prev7_traffic_bytes);
                    return change.percent > 0 ? (
                      <span className={`text-[8px] font-semibold px-0.5 py-0.5 rounded ${
                        change.isPositive 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {change.isPositive ? '+' : '-'}{change.percent.toFixed(0)}%
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
              
              <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded p-1.5 border border-green-200 dark:border-green-800">
                <div className="text-[9px] text-green-600 dark:text-green-400 font-medium mb-0.5">
                  CONNS
                </div>
                <div className="flex items-baseline gap-0.5">
                  <div className="text-sm font-bold text-green-700 dark:text-green-300">
                    <NumberFlow 
                      value={user.sum7_conns} 
                      format={{ notation: user.sum7_conns >= 1000 ? 'compact' : 'standard' }}
                      {...defaultNumberFlowConfig}
                      trend={(oldVal, newVal) => Math.sign(newVal - oldVal)}
                    />
                  </div>
                  {(() => {
                    const change = calculateChange(user.sum7_conns, user.sum_prev7_conns);
                    return change.percent > 0 ? (
                      <span className={`text-[8px] font-semibold px-0.5 py-0.5 rounded ${
                        change.isPositive 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {change.isPositive ? '+' : '-'}{change.percent.toFixed(0)}%
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Top Domains - Compact with Connections */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground">
                <Globe className="w-2.5 h-2.5" />
                <span>Top 3</span>
              </div>
              <div className="space-y-0.5">
                {user.top_domains_traffic.slice(0, 3).map((domain, idx) => {
                  const connData = user.top_domains_conns?.find(d => d.domain === domain.domain);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-0.5 text-[8px] bg-muted/50 rounded px-1 py-0.5"
                    >
                      <span className="text-primary font-semibold w-7">
                        {domain.pct.toFixed(0)}%
                      </span>
                      <span className="text-muted-foreground font-medium text-[7px]">
                        {formatBytes(domain.value)}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="flex-1 truncate font-mono">
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
