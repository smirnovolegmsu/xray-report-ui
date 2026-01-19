import axios from 'axios';
import type {
  Settings,
  User,
  UserStats,
  DashboardApiResponse,
  LiveData,
  UserLink,
  Event,
  ApiResponse,
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
  }) => api.get<any>('/usage/dashboard', { params }),

  // Online/Live
  getOnlineData: () => api.get<LiveData>('/online'),
  
  getLiveNow: () => api.get<any>('/live/now'),
  
  getLiveSeries: (params: {
    metric: 'conns' | 'traffic' | 'online_users';
    period: string;
    gran: string;
    scope: string;
  }) => api.get<any>('/live/series', { params }),

  // Events
  getEvents: (params?: { limit?: number }) => 
    api.get<{ events: Event[] }>('/events', { params }),
  
  getEventsStats: (hours?: number) =>
    api.get<any>('/events/stats', { params: { hours } }),

  // System
  restartService: (service: string) => 
    api.post<ApiResponse>('/system/restart', { service }),
  
  getServiceStatus: (service: string) => 
    api.get<{ active: boolean; status: string }>('/system/status', {
      params: { service },
    }),
  
  getSystemStatus: () => api.get<any>('/system/status'),
  
  getSystemResources: () => api.get<any>('/system/resources'),
  
  restartUI: () => api.post<ApiResponse>('/system/restart-ui'),
  
  restartSystem: () => api.post<ApiResponse>('/system/restart'),
  
  getJournal: (params: { service: 'xray-report-ui' | 'xray'; lines?: number }) => 
    api.get<{ logs: string }>('/system/journal', { params }),

  // Xray
  getXrayConfig: () => api.get<any>('/xray/config'),
  
  restartXray: () => api.post<ApiResponse>('/xray/restart'),

  // Collector
  getCollectorStatus: () => api.get<any>('/collector/status'),
  
  toggleCollector: () => api.post<ApiResponse>('/collector/toggle'),
  
  updateCronSchedule: (script: string, schedule: string) =>
    api.post<ApiResponse>('/collector/update-schedule', { script, schedule }),

  // Backups
  getBackups: () => api.get<{ backups: any[] }>('/backups'),
  
  // Live Top (missing endpoint)
  getLiveTop: (params: {
    metric: 'conns' | 'traffic';
    period: string;
    scope: string;
  }) => api.get<any>('/live/top', { params }),

  // Ports Status
  getPortsStatus: () => api.get<any>('/ports/status'),

  // Generic request method
  request: <T = any>(url: string, options?: any) => api.get<T>(url, options),
};

// Re-export handleApiError from utils for backward compatibility
export { handleApiError } from '@/lib/utils';
