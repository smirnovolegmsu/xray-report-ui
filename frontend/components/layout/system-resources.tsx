'use client';

import { useMemo, useCallback, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Cpu, MemoryStick, AlertTriangle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { motion } from 'framer-motion';
import { useSystemResources } from '@/lib/swr';

interface SystemResourcesData {
  cpu: number;
  ram: number;
  ram_total_gb: number;
  ram_used_gb: number;
}

export const SystemResources = memo(function SystemResources() {
  const { lang } = useAppStore();

  // Use SWR for data fetching with automatic caching and deduplication
  const { data: rawData, isLoading: loading } = useSystemResources();

  // Process data into resources object
  const resources = useMemo<SystemResourcesData | null>(() => {
    if (!rawData || typeof rawData.cpu !== 'number' || typeof rawData.ram !== 'number') {
      return null;
    }
    return {
      cpu: Number(rawData.cpu) || 0,
      ram: Number(rawData.ram) || 0,
      ram_total_gb: Number(rawData.ram_total_gb) || 0,
      ram_used_gb: Number(rawData.ram_used_gb) || 0,
    };
  }, [rawData]);

  const getCpuColor = useCallback((cpu: number) => {
    if (cpu >= 80) return 'text-red-600 dark:text-red-400 border-red-500/50';
    if (cpu >= 60) return 'text-orange-600 dark:text-orange-400 border-orange-500/50';
    return 'text-green-600 dark:text-green-400 border-green-500/50';
  }, []);

  const getRamColor = useCallback((ram: number) => {
    if (ram >= 85) return 'text-red-600 dark:text-red-400 border-red-500/50';
    if (ram >= 70) return 'text-orange-600 dark:text-orange-400 border-orange-500/50';
    return 'text-green-600 dark:text-green-400 border-green-500/50';
  }, []);

  const isOverloaded = useMemo(() => {
    if (!resources) return false;
    return resources.cpu >= 80 || resources.ram >= 85;
  }, [resources]);

  const cpuColor = useMemo(() => resources ? getCpuColor(resources.cpu) : '', [resources, getCpuColor]);
  const ramColor = useMemo(() => resources ? getRamColor(resources.ram) : '', [resources, getRamColor]);

  if (loading || !resources) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="h-6 px-2 text-xs animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin mr-1" />
          <div className="w-12 h-3 bg-muted rounded"></div>
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Индикатор перегрузки */}
      {isOverloaded && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex items-center"
        >
          <Badge 
            variant="outline" 
            className="h-6 px-2 text-xs border-red-500/50 text-red-600 dark:text-red-400"
            title={lang === 'ru' ? 'Сервер перегружен' : 'Server overloaded'}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            {lang === 'ru' ? 'Перегрузка' : 'Overload'}
          </Badge>
        </motion.div>
      )}

      {/* CPU */}
      <Badge 
        variant="outline" 
        className={`h-6 px-2 text-xs gap-1 ${cpuColor}`}
        title={lang === 'ru' ? `CPU: ${resources.cpu.toFixed(1)}%` : `CPU: ${resources.cpu.toFixed(1)}%`}
      >
        <Cpu className="w-3 h-3" />
        <span className="font-semibold">{resources.cpu.toFixed(0)}%</span>
      </Badge>

      {/* RAM */}
      <Badge 
        variant="outline" 
        className={`h-6 px-2 text-xs gap-1 ${ramColor}`}
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
});
