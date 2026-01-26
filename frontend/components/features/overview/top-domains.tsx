'use client';

import { useMemo, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { formatBytes } from '@/lib/utils';
import { useDashboard } from '@/lib/swr';

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
  const { lang } = useAppStore();

  // Use SWR for data fetching with automatic caching and deduplication
  const { data: dashboardData, isLoading: loading } = useDashboard(14);

  // Process dashboard data into domains list
  const domains = useMemo<DomainStat[]>(() => {
    if (!dashboardData?.ok) return [];

    const globalData = dashboardData.global || {};
    const topDomainsTraffic = globalData.top_domains_traffic || [];
    const topDomainsConns = globalData.top_domains_conns || [];

    return topDomainsTraffic
      .filter((item: any) => item && item.domain)
      .map((item: any) => ({
        domain: item.domain,
        traffic_bytes: item.value || 0,
        connections: topDomainsConns.find((d: any) => d?.domain === item.domain)?.value || 0,
      }));
  }, [dashboardData]);

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
