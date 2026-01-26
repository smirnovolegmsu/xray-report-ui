'use client';

import { useMemo, useCallback, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Server, Activity, Database } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSystemStatus, useCollectorStatus } from '@/lib/swr';
import type { ServiceStatus } from '@/types';

interface StatusData {
  ui: ServiceStatus;
  xray: ServiceStatus;
  collector: { active: boolean; found: boolean };
}

export const StatusBadges = memo(function StatusBadges() {
  const router = useRouter();

  // Use SWR for data fetching with automatic caching and deduplication
  const { data: systemData, isLoading: systemLoading } = useSystemStatus();
  const { data: collectorData, isLoading: collectorLoading } = useCollectorStatus();

  const loading = systemLoading || collectorLoading;

  // Process data into status object
  const status = useMemo<StatusData | null>(() => {
    if (!systemData) return null;

    return {
      ui: systemData.ui || { active: false, state: 'unknown' },
      xray: systemData.xray || { active: false, state: 'unknown' },
      collector: {
        active: collectorData?.cron?.found || false,
        found: collectorData?.cron?.found || false,
      },
    };
  }, [systemData, collectorData]);

  const handleUIClick = useCallback(() => {
    router.push('/settings?tab=system');
  }, [router]);

  const handleXrayClick = useCallback(() => {
    router.push('/settings?tab=system');
  }, [router]);

  const handleCollectorClick = useCallback(() => {
    router.push('/settings?tab=collector');
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="animate-pulse">
          <div className="w-12 h-3 bg-muted rounded"></div>
        </Badge>
        <Badge variant="outline" className="animate-pulse">
          <div className="w-12 h-3 bg-muted rounded"></div>
        </Badge>
        <Badge variant="outline" className="animate-pulse">
          <div className="w-12 h-3 bg-muted rounded"></div>
        </Badge>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="flex items-center gap-2">
      {/* UI Badge */}
      <Badge
        variant={status.ui.active ? 'default' : 'destructive'}
        className="cursor-pointer hover:opacity-80 transition-opacity gap-1.5"
        onClick={handleUIClick}
      >
        <Server className="w-3 h-3" />
        UI
      </Badge>

      {/* Xray Badge */}
      <Badge
        variant={status.xray.active ? 'default' : 'destructive'}
        className="cursor-pointer hover:opacity-80 transition-opacity gap-1.5"
        onClick={handleXrayClick}
      >
        <Activity className="w-3 h-3" />
        Xray
      </Badge>

      {/* Collector Badge */}
      <Badge
        variant={status.collector.found ? 'default' : 'secondary'}
        className="cursor-pointer hover:opacity-80 transition-opacity gap-1.5"
        onClick={handleCollectorClick}
      >
        <Database className="w-3 h-3" />
        Collector
      </Badge>
    </div>
  );
});
