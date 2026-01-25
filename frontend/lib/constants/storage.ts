/**
 * Centralized storage keys for localStorage
 * All storage keys used in the application should be defined here
 */

export const STORAGE_KEYS = {
  // UI State
  SIDEBAR_OPEN: 'sidebar-open',
  VIEWPORT_MODE: 'viewport-mode',
  
  // Overview/Dashboard
  OVERVIEW_MODE: 'overview-mode',
  OVERVIEW_METRIC: 'overview-metric',
  
  // Live/Online
  LIVE_SCOPE: 'live-scope',
  LIVE_METRIC: 'live-metric',
  LIVE_PERIOD: 'live-period',
  LIVE_GRANULARITY: 'live-granularity',
  LIVE_CHART_TYPE: 'live-chart-type',
  
  // App Store (managed by zustand)
  APP_STORAGE: 'xray-ui-storage',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
