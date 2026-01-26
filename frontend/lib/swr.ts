'use client';

import useSWR, { SWRConfiguration, mutate } from 'swr';
import { apiClient } from './api';
import type {
  DashboardApiResponse,
  User,
  UserStats,
  Event,
  EventsStatsResponse,
  SystemStatus,
  SystemResources,
  PortsStatusResponse,
  LiveNowResponse,
  LiveSeriesResponse,
  CollectorStatus,
} from '@/types';

// ==================== FETCHERS ====================
// Fetchers extract data from axios response

const fetchers = {
  dashboard: async (days: number = 14) => {
    const res = await apiClient.getDashboard({ days });
    return res.data;
  },

  users: async () => {
    const res = await apiClient.getUsers();
    return res.data?.users || [];
  },

  userStats: async (uuid?: string) => {
    const res = await apiClient.getUserStats(uuid);
    return res.data?.users || [];
  },

  events: async (limit: number = 100) => {
    const res = await apiClient.getEvents({ limit });
    return res.data?.events || [];
  },

  eventsStats: async (hours: number = 24) => {
    const res = await apiClient.getEventsStats(hours);
    return res.data;
  },

  systemStatus: async () => {
    const res = await apiClient.getSystemStatus();
    return res.data;
  },

  systemResources: async () => {
    const res = await apiClient.getSystemResources();
    return res.data;
  },

  portsStatus: async () => {
    const res = await apiClient.getPortsStatus();
    return res.data;
  },

  liveNow: async () => {
    const res = await apiClient.getLiveNow();
    return res.data;
  },

  liveSeries: async (params: {
    metric: 'conns' | 'traffic' | 'online_users';
    period: string;
    gran: string;
    scope: string;
  }) => {
    const res = await apiClient.getLiveSeries(params);
    return res.data;
  },

  collectorStatus: async () => {
    const res = await apiClient.getCollectorStatus();
    return res.data;
  },
};

// ==================== SWR HOOKS ====================

// Default SWR config with sensible defaults
const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false, // Don't refetch when window gains focus
  revalidateOnReconnect: true, // Refetch when network reconnects
  dedupingInterval: 5000, // Dedupe requests within 5 seconds
  errorRetryCount: 3, // Retry failed requests 3 times
};

/**
 * Dashboard data hook
 * Used in: Overview page (metrics, chart, top domains)
 */
export function useDashboard(days: number = 14, config?: SWRConfiguration) {
  return useSWR<DashboardApiResponse>(
    ['dashboard', days],
    () => fetchers.dashboard(days),
    {
      ...defaultConfig,
      refreshInterval: 60000, // Refresh every 60 seconds
      ...config,
    }
  );
}

/**
 * Users list hook
 * Used in: Users page
 */
export function useUsers(config?: SWRConfiguration) {
  return useSWR<User[]>(
    'users',
    fetchers.users,
    {
      ...defaultConfig,
      refreshInterval: 30000, // Refresh every 30 seconds
      ...config,
    }
  );
}

/**
 * User stats hook
 * Used in: Users page, Overview page
 */
export function useUserStats(uuid?: string, config?: SWRConfiguration) {
  return useSWR<UserStats[]>(
    uuid ? ['userStats', uuid] : 'userStats',
    () => fetchers.userStats(uuid),
    {
      ...defaultConfig,
      refreshInterval: 30000,
      ...config,
    }
  );
}

/**
 * Events list hook
 * Used in: Events page
 */
export function useEvents(limit: number = 100, config?: SWRConfiguration) {
  return useSWR<Event[]>(
    ['events', limit],
    () => fetchers.events(limit),
    {
      ...defaultConfig,
      refreshInterval: 30000, // Refresh every 30 seconds
      ...config,
    }
  );
}

/**
 * Events stats hook
 * Used in: Events page (timeline, sidebar)
 */
export function useEventsStats(hours: number = 24, config?: SWRConfiguration) {
  return useSWR<EventsStatsResponse>(
    ['eventsStats', hours],
    () => fetchers.eventsStats(hours),
    {
      ...defaultConfig,
      refreshInterval: 30000,
      ...config,
    }
  );
}

/**
 * System status hook
 * Used in: Header (status badges)
 */
export function useSystemStatus(config?: SWRConfiguration) {
  return useSWR<SystemStatus>(
    'systemStatus',
    fetchers.systemStatus,
    {
      ...defaultConfig,
      refreshInterval: 10000, // Refresh every 10 seconds
      ...config,
    }
  );
}

/**
 * System resources hook
 * Used in: Header (CPU, RAM, Disk)
 */
export function useSystemResources(config?: SWRConfiguration) {
  return useSWR<SystemResources>(
    'systemResources',
    fetchers.systemResources,
    {
      ...defaultConfig,
      refreshInterval: 30000,
      ...config,
    }
  );
}

/**
 * Ports status hook
 * Used in: Header (ports status)
 */
export function usePortsStatus(config?: SWRConfiguration) {
  return useSWR<PortsStatusResponse>(
    'portsStatus',
    fetchers.portsStatus,
    {
      ...defaultConfig,
      refreshInterval: 30000,
      ...config,
    }
  );
}

/**
 * Live now hook
 * Used in: Live page (current metrics)
 */
export function useLiveNow(config?: SWRConfiguration) {
  return useSWR<LiveNowResponse>(
    'liveNow',
    fetchers.liveNow,
    {
      ...defaultConfig,
      refreshInterval: 5000, // Refresh every 5 seconds for real-time data
      ...config,
    }
  );
}

/**
 * Live series hook
 * Used in: Live page (charts)
 */
export function useLiveSeries(
  params: {
    metric: 'conns' | 'traffic' | 'online_users';
    period: string;
    gran: string;
    scope: string;
  },
  config?: SWRConfiguration
) {
  return useSWR<LiveSeriesResponse>(
    ['liveSeries', params.metric, params.period, params.gran, params.scope],
    () => fetchers.liveSeries(params),
    {
      ...defaultConfig,
      refreshInterval: 5000,
      ...config,
    }
  );
}

/**
 * Collector status hook
 * Used in: Settings page
 */
export function useCollectorStatus(config?: SWRConfiguration) {
  return useSWR<CollectorStatus>(
    'collectorStatus',
    fetchers.collectorStatus,
    {
      ...defaultConfig,
      refreshInterval: 30000,
      ...config,
    }
  );
}

// ==================== MUTATION HELPERS ====================

/**
 * Invalidate and refetch dashboard data
 */
export function revalidateDashboard() {
  mutate((key) => Array.isArray(key) && key[0] === 'dashboard');
}

/**
 * Invalidate and refetch users data
 */
export function revalidateUsers() {
  mutate('users');
  mutate((key) => Array.isArray(key) && key[0] === 'userStats');
}

/**
 * Invalidate and refetch events data
 */
export function revalidateEvents() {
  mutate((key) => Array.isArray(key) && key[0] === 'events');
  mutate((key) => Array.isArray(key) && key[0] === 'eventsStats');
}

/**
 * Invalidate and refetch system data
 */
export function revalidateSystem() {
  mutate('systemStatus');
  mutate('systemResources');
  mutate('portsStatus');
}

/**
 * Invalidate and refetch live data
 */
export function revalidateLive() {
  mutate('liveNow');
  mutate((key) => Array.isArray(key) && key[0] === 'liveSeries');
}

/**
 * Invalidate all cached data
 */
export function revalidateAll() {
  mutate(() => true);
}
