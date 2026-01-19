'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Server, Activity, Database } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { devLog } from '@/lib/utils';

interface StatusData {
  ui: { active: boolean; status: string };
  xray: { active: boolean; status: string };
  collector: { active: boolean; found: boolean };
}

export function StatusBadges() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const [systemRes, collectorRes] = await Promise.all([
        apiClient.getSystemStatus(),
        apiClient.getCollectorStatus(),
      ]);

      setStatus({
        ui: systemRes.data.ui || { active: false, status: 'unknown' },
        xray: systemRes.data.xray || { active: false, status: 'unknown' },
        collector: {
          active: collectorRes.data.cron?.found || false,
          found: collectorRes.data.cron?.found || false,
        },
      });
      setLoading(false);
    } catch (error) {
      devLog.error('Failed to load status:', error);
      setLoading(false);
    }
  };

  const handleUIClick = () => {
    router.push('/settings?tab=system');
  };

  const handleXrayClick = () => {
    router.push('/settings?tab=system');
  };

  const handleCollectorClick = () => {
    router.push('/settings?tab=collector');
  };

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
}
