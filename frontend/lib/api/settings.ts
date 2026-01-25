/**
 * Settings, Xray, Collector, Backups, Tests, and Ports API endpoints
 */

import { api } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type {
  Settings,
  XrayConfig,
  CollectorStatus,
  CollectorToggleResponse,
  CollectorRunResponse,
  Backup,
  BackupPreview,
  BackupDetail,
  BackupContent,
  BackupCreateResponse,
  BackupRestorePreview,
  BackupRestoreResult,
  PortsStatusResponse,
  ApiResponse,
  TestHistoryEntry,
  TestHistoryStats,
} from '@/types';

export const settingsApi = {
  // Settings
  getSettings: () => api.get<Settings>(API_ENDPOINTS.SETTINGS),
  
  setSettings: (data: Partial<Settings>) => 
    api.post<ApiResponse>(API_ENDPOINTS.SETTINGS, data),

  // Xray
  getXrayConfig: () => api.get<XrayConfig>(API_ENDPOINTS.XRAY_CONFIG),
  
  restartXray: () => api.post<ApiResponse>(API_ENDPOINTS.XRAY_RESTART),

  // Collector
  getCollectorStatus: () => api.get<CollectorStatus>(API_ENDPOINTS.COLLECTOR_STATUS),
  
  toggleCollector: (enabled: boolean, script?: string) => 
    api.post<CollectorToggleResponse>(API_ENDPOINTS.COLLECTOR_TOGGLE, { enabled, script }),
  
  runCollector: (includeToday: boolean = false) =>
    api.post<CollectorRunResponse>(API_ENDPOINTS.COLLECTOR_RUN, { include_today: includeToday }),
  
  // updateCronSchedule - Not implemented in backend
  // updateCronSchedule: (script: string, schedule: string) =>
  //   api.post<ApiResponse>(API_ENDPOINTS.COLLECTOR_UPDATE_SCHEDULE, { script, schedule }),

  // Backups
  // Backend uses path parameters: /api/backups/<filename>/preview, /api/backups/<filename>/restore
  // And DELETE method for deletion: DELETE /api/backups/<filename>
  getBackups: () => api.get<{ backups: Backup[] }>(API_ENDPOINTS.BACKUPS),
  
  getBackupPreview: (filename: string) => 
    api.get<BackupPreview>(`${API_ENDPOINTS.BACKUPS}/${filename}/preview`),
  
  getBackupDetail: (filename: string) => 
    api.get<BackupDetail>(`${API_ENDPOINTS.BACKUPS}/${filename}/detail`),
  
  getBackupContent: (filename: string) => 
    api.get<BackupContent>(`${API_ENDPOINTS.BACKUPS}/${filename}/content`),
  
  downloadBackup: async (filename: string) => {
    // Use content endpoint and convert to blob
    const response = await api.get<BackupContent>(`${API_ENDPOINTS.BACKUPS}/${filename}/content`);
    // Convert JSON to blob for download
    const blob = new Blob([JSON.stringify(response.data.content, null, 2)], { type: 'application/json' });
    return { data: blob } as any;
  },
  
  createBackup: (label?: string) =>
    api.post<BackupCreateResponse>(`${API_ENDPOINTS.BACKUPS}/create`, { label: label || 'manual' }),
  
  restoreBackup: (filename: string, confirm: boolean = false, restartXray: boolean = true) =>
    api.post<BackupRestorePreview | BackupRestoreResult>(`${API_ENDPOINTS.BACKUPS}/${filename}/restore`, {
      confirm,
      restart_xray: restartXray,
    }),
  
  deleteBackup: (filename: string) =>
    api.delete<ApiResponse>(`${API_ENDPOINTS.BACKUPS}/${filename}`),

  // Ports
  getPortsStatus: () => api.get<PortsStatusResponse>(API_ENDPOINTS.PORTS_STATUS),

  // Tests
  getTestStatus: () => api.get<ApiResponse<{
    pytest_available: boolean;
    tests_directory_exists: boolean;
    test_files_count: number;
    status: string;
  }>>(API_ENDPOINTS.TESTS_STATUS),
  
  getTestFiles: () => api.get<ApiResponse<{
    test_files: Array<{ name: string; path: string; full_path?: string }>;
  }>>(API_ENDPOINTS.TESTS_LIST),
  
  runTests: (path?: string, verbose?: boolean) => {
    const params: Record<string, string> = {};
    if (path) params.path = path;
    if (verbose) params.verbose = 'true';
    return api.get<ApiResponse<{
      success: boolean;
      return_code: number;
      summary: {
        passed: number;
        failed: number;
        errors: number;
        total: number;
      };
      tests: Array<{
        name: string;
        status: 'passed' | 'failed' | 'error';
        output?: string;
      }>;
      output?: string;
      error_output?: string;
      error?: string;
    }>>(API_ENDPOINTS.TESTS_RUN, { params });
  },
  
  getTestsHistory: (limit?: number) => {
    const url = limit ? `${API_ENDPOINTS.TESTS_HISTORY}?limit=${limit}` : API_ENDPOINTS.TESTS_HISTORY;
    return api.get<ApiResponse<{
      history: TestHistoryEntry[];
      stats: TestHistoryStats;
      total: number;
    }>>(url);
  },
  
  getTestsHistoryStats: () => api.get<ApiResponse<TestHistoryStats>>(API_ENDPOINTS.TESTS_HISTORY_STATS),
};
