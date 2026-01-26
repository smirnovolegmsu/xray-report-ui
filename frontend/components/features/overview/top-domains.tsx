'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { handleApiError } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { formatBytes, devLog } from '@/lib/utils';
import type { DashboardApiResponse } from '@/types';

interface DomainStat {
  domain: string;
  traffic_bytes: number;
  connections: number;
}

interface TopDomainsProps {
  selectedDate: string | null;
  mode: 'daily' | 'cumulative';
}

export const TopDomains = memo(function TopDomains({ selectedDate, mode }: TopDomainsProps) {
  const [domains, setDomains] = useState<DomainStat[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  const loadDomains = useCallback(async () => {
    try {
      setLoading(true);

      const response = await apiClient.getDashboard({ days: 14 });

      if (!response?.data) {
        throw new Error('Empty response from server');
      }
      const data = response.data as DashboardApiResponse;

      if (!data?.ok) {
        throw new Error(data?.error || 'Failed to load data');
      }
      
      const globalData = data.global || {};
      const topDomainsTraffic = globalData.top_domains_traffic || [];
      const topDomainsConns = globalData.top_domains_conns || [];
      
      const domainsList = topDomainsTraffic
        .filter((item: any) => item && item.domain) // Filter out invalid entries
        .map((item: any) => ({
          domain: item.domain,
          traffic_bytes: item.value || 0,
          connections: topDomainsConns.find((d: any) => d?.domain === item.domain)?.value || 0,
        }));
      
      setDomains(domainsList);
    } catch (error) {
      devLog.error('Error loading domains:', error);
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, mode]);

  // CRITICAL: useEffect MUST be called before any early returns (Rules of Hooks)
  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Early returns AFTER all hooks are called
  if (loading) {
    return (
      <Card className="p-3 w-full lg:w-[408px] min-h-[200px] lg:h-[238px]">
        <div className="h-4 w-32 bg-muted animate-pulse rounded mb-3"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 bg-muted animate-pulse rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  if (domains.length === 0) {
    return (
      <Card className="p-3 w-full lg:w-[408px] min-h-[200px] lg:h-[238px]">
        <h3 className="text-sm font-semibold mb-2">
          {lang === 'ru' ? 'Топ доменов (7 дней)' : 'Top Domains (7 days)'}
        </h3>
        <div className="text-center py-6 text-muted-foreground text-sm">
          {lang === 'ru' ? 'Нет данных' : 'No data'}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 w-full lg:w-[408px] min-h-[200px] lg:h-[238px] flex flex-col">
      <h3 className="text-sm font-semibold mb-2">
        {lang === 'ru' ? 'Топ доменов (7 дней)' : 'Top Domains (7 days)'}
      </h3>
      <div className="flex-1 overflow-hidden">
        {/* Mobile: simple list, Desktop: table */}
        <div className="space-y-1.5">
          {domains.slice(0, 5).map((domain, index) => (
            <div
              key={index}
              className="flex items-center gap-2 py-1 px-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <Badge
                variant={index === 0 ? 'default' : index === 1 ? 'secondary' : 'outline'}
                className="text-[10px] h-5 w-5 justify-center px-0 shrink-0"
              >
                {index + 1}
              </Badge>
              <span
                className="font-mono text-[11px] truncate flex-1 min-w-0"
                title={domain.domain}
              >
                {domain.domain}
              </span>
              <span className="text-xs font-medium whitespace-nowrap tabular-nums">
                {formatBytes(domain.traffic_bytes, { compact: true }) as string}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums w-12 text-right">
                {domain.connections >= 1000
                  ? `${(domain.connections / 1000).toFixed(1)}k`
                  : domain.connections.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
});
