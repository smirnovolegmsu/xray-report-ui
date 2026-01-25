/**
 * API configuration constants
 */

export const API_CONFIG = {
  BASE_URL: '/api',
  TIMEOUT: 30000, // 30 seconds
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  },
} as const;

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  // System
  PING: '/ping',
  VERSION: '/version',
  
  // Settings
  SETTINGS: '/settings',
  
  // Users
  USERS: '/users',
  USERS_ADD: '/users/add',
  USERS_DELETE: '/users/delete',
  USERS_KICK: '/users/kick',
  USERS_LINK: '/users/link',
  USERS_STATS: '/users/stats',
  USERS_UPDATE_ALIAS: '/users/update-alias',
  
  // Usage/Dashboard
  USAGE_DATES: '/usage/dates',
  USAGE_DASHBOARD: '/usage/dashboard',
  
  // Live/Online
  LIVE_NOW: '/live/now',
  LIVE_SERIES: '/live/series',
  LIVE_TOP: '/live/top',
  
  // Events
  EVENTS: '/events',
  EVENTS_STATS: '/events/stats',
  
  // System
  SYSTEM_RESTART: '/system/restart',
  SYSTEM_STATUS: '/system/status',
  SYSTEM_RESOURCES: '/system/resources',
  // SYSTEM_JOURNAL: '/system/journal', // Not implemented in backend
  
  // Xray
  XRAY_CONFIG: '/xray/config',
  XRAY_RESTART: '/xray/restart',
  
  // Collector
  COLLECTOR_STATUS: '/collector/status',
  COLLECTOR_TOGGLE: '/collector/toggle',
  COLLECTOR_RUN: '/collector/run',
  COLLECTOR_UPDATE_SCHEDULE: '/collector/update-schedule',
  
  // Backups
  // Backend uses path parameters: /api/backups/<filename>/preview, /api/backups/<filename>/detail, etc.
  BACKUPS: '/backups',
  
  // Ports
  PORTS_STATUS: '/ports/status',
  
  // Tests
  TESTS_STATUS: '/tests/status',
  TESTS_LIST: '/tests/list',
  TESTS_RUN: '/tests/run',
  TESTS_HISTORY: '/tests/history',
  TESTS_HISTORY_STATS: '/tests/history/stats',
} as const;
