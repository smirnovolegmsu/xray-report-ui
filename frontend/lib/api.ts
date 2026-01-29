import axios from 'axios';
import type {
  Settings,
  User,
  UserStats,
  DashboardApiResponse,
  UserLink,
  Event,
  ApiResponse,
  SystemStatus,
  SystemResources,
  PortsStatusResponse,
  LiveNowResponse,
  LiveSeriesResponse,
  LiveTopResponse,
  UsageDashboardResponse,
  EventsStatsResponse,
  CollectorStatus,
  XrayConfig,
  Backup,
  BackupPreview,
  BackupDetail,
  BackupContent,
  BackupCreateResponse,
  BackupRestorePreview,
  BackupRestoreResult,
  CollectorToggleResponse,
  CollectorRunResponse,
  VersionResponse,
} from '@/types';

// Создаём axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== API CLIENT ====================
export const apiClient = {
  // Ping
  ping: () => api.get<ApiResponse>('/ping'),
  
  // Version
  getVersion: () => api.get<VersionResponse>('/version'),

  // Settings
  getSettings: () => api.get<Settings>('/settings'),
  
  setSettings: (data: Partial<Settings>) => 
    api.post<ApiResponse>('/settings', data),

  // Users
  getUsers: () => api.get<{ users: User[] }>('/users'),
  
  addUser: (email: string) => 
    api.post<ApiResponse>('/users/add', { email }),
  
  deleteUser: (uuid: string) => 
    api.post<ApiResponse>('/users/delete', { uuid }),
  
  kickUser: (uuid: string) => 
    api.post<ApiResponse>('/users/kick', { uuid }),
  
  getUserLink: (uuid: string) => 
    api.get<UserLink>('/users/link', { params: { uuid } }),
  
  getUserStats: (uuid?: string) => 
    api.get<{ users: UserStats[] }>('/users/stats', { params: { uuid } }),
  
  updateUserAlias: (uuid: string, alias: string) =>
    api.post<ApiResponse>('/users/update-alias', { uuid, alias }),

  // Dashboard
  getDashboard: (params?: { days?: number; user_filter?: string }) => 
    api.get<DashboardApiResponse>('/dashboard', { params }),

  // Usage dates
  getUsageDates: () => api.get<{ dates: string[] }>('/usage/dates'),
  
  getUsageDashboard: (params: {
    date?: string;
    mode?: 'daily' | 'cumulative';
    window_days?: number;
  }) => api.get<UsageDashboardResponse>('/usage/dashboard', { params }),

  // Online/Live
  // Note: getOnlineData() removed - endpoint /api/online doesn't exist
  // Use getLiveNow() instead which calls /api/live/now
  
  getLiveNow: () => api.get<LiveNowResponse>('/live/now'),
  
  getLiveSeries: (params: {
    metric: 'conns' | 'traffic' | 'online_users';
    period: string;
    gran: string;
    scope: string;
  }) => api.get<LiveSeriesResponse>('/live/series', { params }),

  // Events
  getEvents: (params?: { limit?: number }) => 
    api.get<{ events: Event[] }>('/events', { params }),
  
  getEventsStats: (hours?: number) =>
    api.get<EventsStatsResponse>('/events/stats', { params: { hours } }),

  // System
  restartService: (service: 'ui' | 'xray' | 'nextjs' | 'all') => 
    api.post<ApiResponse>('/system/restart', {}, {
      params: { target: service },
    }),
  
  getServiceStatus: (service: string) => 
    api.get<{ active: boolean; status: string }>('/system/status', {
      params: { service },
    }),
  
  getSystemStatus: () => api.get<SystemStatus>('/system/status'),

  getSystemResources: () => api.get<SystemResources>('/system/resources'),

  getResourceHistory: (period: string, granularity: string) =>
    api.get<ApiResponse>('/system/resources/history', {
      params: { period, granularity },
    }),

  // Legacy methods - use restartService() instead
  /** @deprecated Use restartService('ui') instead */
  restartUI: () => api.post<ApiResponse>('/system/restart', {}, {
    params: { target: 'ui' },
  }),
  
  /** @deprecated Use restartService('all') instead */
  restartSystem: () => api.post<ApiResponse>('/system/restart', {}, {
    params: { target: 'all' },
  }),
  
  getJournal: (params: { target: 'ui' | 'xray'; limit?: number }) => 
    api.get<{ service: string; journal: string; lines: string[]; timezone?: string }>('/system/journal', { params }),

  // Xray
  getXrayConfig: () => api.get<XrayConfig>('/xray/config'),
  
  restartXray: () => api.post<ApiResponse>('/xray/restart'),

  // Collector
  getCollectorStatus: () => api.get<CollectorStatus>('/collector/status'),
  
  toggleCollector: (enabled: boolean, script?: string) => 
    api.post<CollectorToggleResponse>('/collector/toggle', { enabled, script }),
  
  runCollector: (includeToday: boolean = false) =>
    api.post<CollectorRunResponse>('/collector/run', { include_today: includeToday }),
  
  updateCronSchedule: (script: string, schedule: string) =>
    api.post<ApiResponse>('/collector/update-schedule', { script, schedule }),

  // Backups
  getBackups: () => api.get<{ backups: Backup[] }>('/backups'),
  
  getBackupPreview: (filename: string) => 
    api.get<BackupPreview>('/backups/preview', { params: { filename } }),
  
  getBackupDetail: (filename: string) => 
    api.get<BackupDetail>('/backups/detail', { params: { filename } }),
  
  getBackupContent: (filename: string) => 
    api.get<BackupContent>('/backups/view', { params: { filename } }),
  
  downloadBackup: (filename: string) => 
    api.get<Blob>('/backups/download', { 
      params: { filename },
      responseType: 'blob',
    }),
  
  createBackup: () =>
    api.post<BackupCreateResponse>('/backups/create'),
  
  restoreBackup: (filename: string, confirm: boolean = false, restartXray: boolean = true) =>
    api.post<BackupRestorePreview | BackupRestoreResult>('/backups/restore', {
      filename,
      confirm,
      restart_xray: restartXray,
    }),
  
  deleteBackup: (filename: string) =>
    api.post<ApiResponse>('/backups/delete', { filename }),
  
  // Live Top
  getLiveTop: (params: {
    metric: 'conns' | 'traffic';
    period: string;
    scope: string;
  }) => api.get<LiveTopResponse>('/live/top', { params }),

  // Ports Status
  getPortsStatus: () => api.get<PortsStatusResponse>('/ports/status'),

  // Diagnostics
  runDiagnostics: () => api.get<ApiResponse>('/diagnostics/run'),

  getLastDiagnostics: () => api.get<ApiResponse>('/diagnostics/last'),

  getDiagnosticsHistory: (limit?: number) =>
    api.get<ApiResponse>('/diagnostics/history', { params: { limit } }),

  getDiagnosticsStats: (days: number) =>
    api.get<ApiResponse>('/diagnostics/stats', { params: { days } }),

  getDiagnosticsAutoRun: () =>
    api.get<ApiResponse>('/diagnostics/auto-run'),

  setDiagnosticsAutoRun: (hours: number) =>
    api.post<ApiResponse>('/diagnostics/auto-run', { hours }),

  // Quality Monitoring
  getQualityOverview: (days?: number) =>
    api.get<ApiResponse>('/quality/overview', { params: { days } }),

  getQualityUsers: (params?: { days?: number; sort?: 'quality' | 'reconnects' | 'speed' }) =>
    api.get<ApiResponse>('/quality/users', { params }),

  getQualitySessions: (email: string, limit?: number) =>
    api.get<ApiResponse>('/quality/sessions', { params: { email, limit } }),

  getQualityTimeline: (email: string, period?: string) =>
    api.get<ApiResponse>('/quality/timeline', { params: { email, period } }),

  getQualityStats: (days?: number) =>
    api.get<ApiResponse>('/quality/stats', { params: { days } }),
  // Device Monitoring
  getUserDevices: (email?: string) =>
    api.get<ApiResponse>('/users/devices', { params: email ? { email } : {} }),

  getUserAnalytics: (email: string, days?: number) =>
    api.get<UserAnalyticsResponse>('/users/analytics', { params: { email, days } }),

  getTrafficCalendar: (email: string, months?: number) =>
    api.get<TrafficCalendarResponse>('/users/traffic-calendar', { params: { email, months } }),

  getIpHistory: (email: string, ip: string, days?: number) =>
    api.get<IpHistoryResponse>('/users/ip-history', { params: { email, ip, days } }),

  getIpHistoriesBatch: (email: string, ips: string[], days?: number) =>
    api.get<IpHistoriesBatchResponse>('/users/ip-histories-batch', { 
      params: { email, ips: ips.join(','), days } 
    }),


  getDisconnectDays: (email: string, days?: number) =>
    api.get<DisconnectDaysResponse>('/users/disconnect-days', { params: { email, days } }),

  getUserPartners: (email: string) =>
    api.get<any>(`/users/${email}/partners`),

  getUserLastSession: (email: string) =>
    api.get<any>(`/users/${email}/last-session`),

  getUserRecentSessions: (email: string) =>
    api.get<any>(`/users/${email}/recent-sessions`),

  getUserDeviceDetection: (email: string) =>
    api.get<any>(`/users/${email}/device-detection`),

  // Generic request method
  request: <T = any>(url: string, options?: any) => api.get<T>(url, options),
};

// Re-export handleApiError from utils for backward compatibility
export { handleApiError } from '@/lib/utils';
