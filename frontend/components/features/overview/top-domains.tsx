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
        // Use today's date to ensure we get correct data structure
        const today = new Date().toISOString().split('T')[0];
        const response = await apiClient.getUsageDashboard({
          date: selectedDate || today,
          mode,
          window_days: 7
        });
      const data = response.data as any;
      
      // Transform from Flask API format
      const topDomainsTraffic = data.global?.top_domains_traffic || [];
      const topDomainsConns = data.global?.top_domains_conns || [];
      
      // Use traffic-based domains (usually more relevant)
      const domains = topDomainsTraffic.map((item: any) => ({
        domain: item.domain,
        traffic_bytes: item.value || 0,
        connections: topDomainsConns.find((d: any) => d.domain === item.domain)?.value || 0,
      }));
      
      setDomains(domains);
    } catch (error) {
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
      <Card className="p-2">
        <div className="h-3 w-40 bg-muted animate-pulse rounded mb-2"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-muted animate-pulse rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  if (domains.length === 0) {
    return (
      <Card className="p-2">
        <h3 className="text-xs font-semibold mb-2">
          {lang === 'ru' ? 'Топ доменов' : 'Top Domains'}
        </h3>
        <div className="text-center py-6 text-muted-foreground text-xs">
          {lang === 'ru' ? 'Нет данных о доменах' : 'No domain data available'}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-2">
      <h3 className="text-xs font-semibold mb-2">
        {lang === 'ru' ? 'Топ доменов (7 дней)' : 'Top Domains (7 days)'}
      </h3>
      <div className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35px] py-1 text-[10px]">#</TableHead>
              <TableHead className="py-1 text-[10px]">{lang === 'ru' ? 'Домен' : 'Domain'}</TableHead>
              <TableHead className="text-right py-1 text-[10px]">
                {lang === 'ru' ? 'Трафик' : 'Traffic'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.slice(0, 7).map((domain, index) => (
              <TableRow key={index}>
                <TableCell className="py-1 text-[10px]">
                  {index < 3 ? (
                    <Badge
                      variant={
                        index === 0
                          ? 'default'
                          : index === 1
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-[9px] h-4 px-1"
                    >
                      {index + 1}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">{index + 1}</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-[10px] py-1 truncate max-w-[120px]">
                  {domain.domain}
                </TableCell>
                <TableCell className="text-right font-medium text-[10px] py-1">
                  {formatBytes(domain.traffic_bytes)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-[10px] py-1">
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
