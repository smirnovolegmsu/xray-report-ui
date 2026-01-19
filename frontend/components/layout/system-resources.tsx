'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Cpu, MemoryStick, AlertTriangle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { devLog } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SystemResources {
  cpu: number;
  ram: number;
  ram_total_gb: number;
  ram_used_gb: number;
  responseTime?: number; // время ответа в мс
}

export const SystemResources = memo(function SystemResources() {
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseTime, setResponseTime] = useState<number>(0);
  const { lang } = useAppStore();

  const loadResources = useCallback(async () => {
    const startTime = Date.now();
    try {
      const response = await apiClient.getSystemResources();
      const responseTimeMs = Date.now() - startTime;
      setResponseTime(responseTimeMs);
      
      // API returns { ok: true, cpu: ..., ram: ..., ram_total_gb: ..., ram_used_gb: ... }
      const data = response?.data;
      if (data && typeof data === 'object' && typeof data.cpu === 'number' && typeof data.ram === 'number') {
        setResources({
          cpu: Number(data.cpu) || 0,
          ram: Number(data.ram) || 0,
          ram_total_gb: Number(data.ram_total_gb) || 0,
          ram_used_gb: Number(data.ram_used_gb) || 0,
          responseTime: responseTimeMs,
        });
      } else {
        // Set default values if data is invalid
        setResources({
          cpu: 0,
          ram: 0,
          ram_total_gb: 0,
          ram_used_gb: 0,
          responseTime: responseTimeMs,
        });
      }
      setLoading(false);
    } catch (error) {
      devLog.warn('Failed to load system resources:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();
    // Update every 30 seconds (быстрее для более актуальной информации)
    const interval = setInterval(loadResources, 30000);
    return () => clearInterval(interval);
  }, [loadResources]);

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

  const getResponseTimeColor = useCallback((time: number) => {
    if (time > 2000) return 'text-red-600 dark:text-red-400';
    if (time > 1000) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  }, []);

  const isOverloaded = useMemo(() => {
    if (!resources) return false;
    return resources.cpu >= 80 || resources.ram >= 85 || (resources.responseTime || 0) > 2000;
  }, [resources]);

  const cpuColor = useMemo(() => resources ? getCpuColor(resources.cpu) : '', [resources, getCpuColor]);
  const ramColor = useMemo(() => resources ? getRamColor(resources.ram) : '', [resources, getRamColor]);
  const responseColor = useMemo(() => responseTime ? getResponseTimeColor(responseTime) : '', [responseTime, getResponseTimeColor]);

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

      {/* Время ответа (показываем только если медленно) */}
      {responseTime > 500 && (
        <Badge 
          variant="outline" 
          className={`h-6 px-2 text-xs gap-1 ${responseColor}`}
          title={lang === 'ru' ? `Время ответа: ${(responseTime / 1000).toFixed(1)}с` : `Response time: ${(responseTime / 1000).toFixed(1)}s`}
        >
          <span className="font-mono text-[10px]">{(responseTime / 1000).toFixed(1)}s</span>
        </Badge>
      )}
    </div>
  );
});
