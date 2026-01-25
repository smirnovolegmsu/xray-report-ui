import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { handleApiError } from '@/lib/utils';
import type { DashboardApiResponse } from '@/types';

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asNumberArray(v: unknown): number[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? x : Number(x) || 0)) : [];
}

function sanitizeDashboardResponse(payload: DashboardApiResponse): DashboardApiResponse {
  const global = payload.global || {};
  const meta = payload.meta || {};

  return {
    ...payload,
    global: {
      ...global,
      daily_traffic_bytes: asNumberArray(global.daily_traffic_bytes),
      prev_daily_traffic_bytes: asNumberArray(global.prev_daily_traffic_bytes),
      daily_conns: asNumberArray(global.daily_conns),
      prev_daily_conns: asNumberArray(global.prev_daily_conns),
      cumulative_traffic_bytes: asNumberArray(global.cumulative_traffic_bytes),
      cumulative_conns: asNumberArray(global.cumulative_conns),
      top_domains_traffic: Array.isArray(global.top_domains_traffic) ? global.top_domains_traffic : [],
      top_domains_conns: Array.isArray(global.top_domains_conns) ? global.top_domains_conns : [],
    },
    meta: {
      ...meta,
      days: asStringArray(meta.days),
      prev_days: asStringArray(meta.prev_days),
      users: asStringArray(meta.users),
    },
    users: payload.users && typeof payload.users === 'object' ? payload.users : {},
  };
}

export interface UseDashboardDataParams {
  days?: number;
  date?: string | null;
  user?: string;
  enabled?: boolean;
}

export interface UseDashboardDataResult {
  data: DashboardApiResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboardData(params: UseDashboardDataParams = {}): UseDashboardDataResult {
  const { days = 14, date = null, user, enabled = true } = params;

  const [data, setData] = useState<DashboardApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getDashboard({
        days,
        user,
        date: date ?? undefined,
      });

      const payload = response.data as DashboardApiResponse;
      if (!payload?.ok) {
        throw new Error(payload?.error || 'Failed to load dashboard data');
      }

      setData(sanitizeDashboardResponse(payload));
    } catch (e) {
      setError(handleApiError(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days, date, enabled, user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return useMemo(
    () => ({ data, loading, error, refetch }),
    [data, loading, error, refetch]
  );
}

