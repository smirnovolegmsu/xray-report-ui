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

  // Size matches 2 metric cards: 408px width (200+200+8), 238px height (115+115+8)
  // Early returns AFTER all hooks are called
  if (loading) {
    return (
      <Card className="p-3 w-[408px] h-[238px]">
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
      <Card className="p-3 w-[408px] h-[238px]">
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
    <Card className="p-3 w-[408px] h-[238px] flex flex-col">
      <h3 className="text-sm font-semibold mb-1">
        {lang === 'ru' ? 'Топ доменов (7 дней)' : 'Top Domains (7 days)'}
      </h3>
      <div className="flex-1 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-7 py-1 text-xs">#</TableHead>
              <TableHead className="py-1 text-xs">{lang === 'ru' ? 'Домен' : 'Domain'}</TableHead>
              <TableHead className="text-right py-1 text-xs">{lang === 'ru' ? 'Трафик' : 'Traffic'}</TableHead>
              <TableHead className="text-right py-1 text-xs">{lang === 'ru' ? 'Подкл.' : 'Conns'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.slice(0, 5).map((domain, index) => (
              <TableRow key={index}>
                <TableCell className="py-1 text-xs">
                  <Badge
                    variant={index === 0 ? 'default' : index === 1 ? 'secondary' : 'outline'}
                    className="text-[10px] h-4 w-4 justify-center px-0"
                  >
                    {index + 1}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[11px] py-1">
                  <span className="block truncate max-w-[180px]" title={domain.domain}>
                    {domain.domain}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium text-xs py-1 whitespace-nowrap">
                  {formatBytes(domain.traffic_bytes, { decimals: 2 }) as string}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-xs py-1 whitespace-nowrap">
                  {domain.connections.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
});
