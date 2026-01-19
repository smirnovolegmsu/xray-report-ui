'use client';

import { useEffect, useState } from 'react';
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
import { apiClient, handleApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

interface DomainStat {
  domain: string;
  traffic_bytes: number;
  connections: number;
}

interface TopDomainsProps {
  selectedDate: string | null;
  mode: 'daily' | 'cumulative';
}

export function TopDomains({ selectedDate, mode }: TopDomainsProps) {
  const [domains, setDomains] = useState<DomainStat[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    loadDomains();
  }, [selectedDate, mode]);

    const loadDomains = async () => {
      try {
        setLoading(true);
        
        // Use getDashboard API (same as port 8787)
        const response = await apiClient.getDashboard({ days: 14 });
        const data = response.data as any;
        
        if (!data.ok) {
          throw new Error(data.error || 'Failed to load data');
        }
        
        // Get top domains from global data
        const globalData = data.global || {};
        const topDomainsTraffic = globalData.top_domains_traffic || [];
        const topDomainsConns = globalData.top_domains_conns || [];
        
        // Use traffic-based domains (usually more relevant)
        const domainsList = topDomainsTraffic.map((item: any) => ({
          domain: item.domain,
          traffic_bytes: item.value || 0,
          connections: topDomainsConns.find((d: any) => d.domain === item.domain)?.value || 0,
        }));
        
        setDomains(domainsList);
    } catch (error) {
      console.error('Error loading domains:', error);
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Card className="p-2 container-chart">
        <div className="h-3 w-32 bg-muted animate-pulse rounded mb-2"></div>
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 bg-muted animate-pulse rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  if (domains.length === 0) {
    return (
      <Card className="p-2 container-chart">
        <h3 className="text-[10px] @[400px]:text-xs font-semibold mb-2">
          {lang === 'ru' ? 'Топ доменов' : 'Top Domains'}
        </h3>
        <div className="text-center py-6 text-muted-foreground text-xs">
          {lang === 'ru' ? 'Нет данных о доменах' : 'No domain data available'}
        </div>
      </Card>
    );
  }

  // Adaptive number of domains based on container width
  const visibleDomainCount = 5; // Will be controlled by CSS display

  return (
    <Card className="p-2 container-chart">
      <h3 className="text-[10px] @[400px]:text-xs font-semibold mb-2 truncate">
        <span className="@[400px]:hidden">{lang === 'ru' ? 'Топ-5' : 'Top 5'}</span>
        <span className="hidden @[400px]:inline">{lang === 'ru' ? 'Топ доменов (7 дней)' : 'Top Domains (7 days)'}</span>
      </h3>
      <div className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28px] @[400px]:w-[35px] py-1 text-[9px] @[400px]:text-[10px]">#</TableHead>
              <TableHead className="py-1 text-[9px] @[400px]:text-[10px]">{lang === 'ru' ? 'Домен' : 'Domain'}</TableHead>
              <TableHead className="text-right py-1 text-[9px] @[400px]:text-[10px]">
                {lang === 'ru' ? 'Трафик' : 'Traffic'}
              </TableHead>
              {/* Connections column - hide on small screens */}
              <TableHead className="text-right py-1 text-[9px] @[400px]:text-[10px] hidden @[500px]:table-cell">
                {lang === 'ru' ? 'Подкл.' : 'Conns'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* First 3 domains - always visible */}
            {domains.slice(0, 3).map((domain, index) => (
              <TableRow key={index}>
                <TableCell className="py-0.5 @[400px]:py-1 text-[9px] @[400px]:text-[10px]">
                  <Badge
                    variant={
                      index === 0
                        ? 'default'
                        : index === 1
                        ? 'secondary'
                        : 'outline'
                    }
                    className="text-[8px] @[400px]:text-[9px] h-3.5 @[400px]:h-4 px-0.5 @[400px]:px-1"
                  >
                    {index + 1}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[9px] @[400px]:text-[10px] py-0.5 @[400px]:py-1 truncate max-w-[100px] @[400px]:max-w-[150px]">
                  {domain.domain}
                </TableCell>
                <TableCell className="text-right font-medium text-[9px] @[400px]:text-[10px] py-0.5 @[400px]:py-1 whitespace-nowrap">
                  {formatBytes(domain.traffic_bytes)}
                </TableCell>
                {/* Connections - hide on small */}
                <TableCell className="text-right text-muted-foreground text-[9px] @[400px]:text-[10px] py-0.5 @[400px]:py-1 hidden @[500px]:table-cell">
                  {domain.connections.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {/* 4th-5th domains - hide on very small screens */}
            {domains.slice(3, 5).map((domain, index) => (
              <TableRow key={index + 3} className="hidden @[400px]:table-row">
                <TableCell className="py-0.5 @[400px]:py-1 text-[9px] @[400px]:text-[10px]">
                  <span className="text-muted-foreground">{index + 4}</span>
                </TableCell>
                <TableCell className="font-mono text-[9px] @[400px]:text-[10px] py-0.5 @[400px]:py-1 truncate max-w-[100px] @[400px]:max-w-[150px]">
                  {domain.domain}
                </TableCell>
                <TableCell className="text-right font-medium text-[9px] @[400px]:text-[10px] py-0.5 @[400px]:py-1 whitespace-nowrap">
                  {formatBytes(domain.traffic_bytes)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-[9px] @[400px]:text-[10px] py-0.5 @[400px]:py-1 hidden @[500px]:table-cell">
                  {domain.connections.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
