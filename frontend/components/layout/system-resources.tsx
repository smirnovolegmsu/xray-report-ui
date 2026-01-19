'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Cpu, MemoryStick } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { devLog } from '@/lib/utils';

interface SystemResources {
  cpu: number;
  ram: number;
  ram_total_gb: number;
  ram_used_gb: number;
}

export function SystemResources() {
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useAppStore();

  useEffect(() => {
    const loadResources = async () => {
      try {
        const response = await apiClient.getSystemResources();
        // API returns { ok: true, cpu: ..., ram: ..., ram_total_gb: ..., ram_used_gb: ... }
        const data = response?.data;
        if (data && typeof data === 'object' && typeof data.cpu === 'number' && typeof data.ram === 'number') {
          setResources({
            cpu: Number(data.cpu) || 0,
            ram: Number(data.ram) || 0,
            ram_total_gb: Number(data.ram_total_gb) || 0,
            ram_used_gb: Number(data.ram_used_gb) || 0,
          });
        } else {
          // Set default values if data is invalid
          setResources({
            cpu: 0,
            ram: 0,
            ram_total_gb: 0,
            ram_used_gb: 0,
          });
        }
        setLoading(false);
      } catch (error) {
        devLog.warn('Failed to load system resources:', error);
        setLoading(false);
      }
    };

    loadResources();
    // Update every 1 minute (60000ms)
    const interval = setInterval(loadResources, 60000);
    return () => clearInterval(interval);
  }, []);

  const getCpuColor = (cpu: number) => {
    if (cpu >= 80) return 'text-red-600 dark:text-red-400';
    if (cpu >= 60) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getRamColor = (ram: number) => {
    if (ram >= 85) return 'text-red-600 dark:text-red-400';
    if (ram >= 70) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  if (loading || !resources) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="h-6 px-2 text-xs animate-pulse">
          <div className="w-12 h-3 bg-muted rounded"></div>
        </Badge>
        <Badge variant="outline" className="h-6 px-2 text-xs animate-pulse">
          <div className="w-12 h-3 bg-muted rounded"></div>
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* CPU */}
      <Badge 
        variant="outline" 
        className={`h-6 px-2 text-xs gap-1 ${getCpuColor(resources.cpu)}`}
        title={lang === 'ru' ? `CPU: ${resources.cpu.toFixed(1)}%` : `CPU: ${resources.cpu.toFixed(1)}%`}
      >
        <Cpu className="w-3 h-3" />
        <span className="font-semibold">{resources.cpu.toFixed(0)}%</span>
      </Badge>

      {/* RAM */}
      <Badge 
        variant="outline" 
        className={`h-6 px-2 text-xs gap-1 ${getRamColor(resources.ram)}`}
        title={
          lang === 'ru' 
            ? `RAM: ${resources.ram.toFixed(1)}% (${resources.ram_used_gb.toFixed(1)}/${resources.ram_total_gb.toFixed(1)} GB)`
            : `RAM: ${resources.ram.toFixed(1)}% (${resources.ram_used_gb.toFixed(1)}/${resources.ram_total_gb.toFixed(1)} GB)`
        }
      >
        <MemoryStick className="w-3 h-3" />
        <span className="font-semibold">{resources.ram.toFixed(0)}%</span>
      </Badge>
    </div>
  );
}
