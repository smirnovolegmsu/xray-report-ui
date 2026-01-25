/**
 * System status, resources, journal, ping, and version API endpoints
 */

import { api } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type {
  ApiResponse,
  SystemStatus,
  SystemResources,
  VersionResponse,
} from '@/types';

export const systemApi = {
  // Ping
  ping: () => api.get<ApiResponse>(API_ENDPOINTS.PING),
  
  // Version
  getVersion: () => api.get<VersionResponse>(API_ENDPOINTS.VERSION),

  // System Status
  restartService: (service: 'ui' | 'xray' | 'nextjs' | 'all') => 
    api.post<ApiResponse>(API_ENDPOINTS.SYSTEM_RESTART, {}, {
      params: { target: service },
    }),
  
  getServiceStatus: (service: string) => 
    api.get<{ active: boolean; status: string }>(API_ENDPOINTS.SYSTEM_STATUS, {
      params: { service },
    }),
  
  getSystemStatus: () => api.get<SystemStatus>(API_ENDPOINTS.SYSTEM_STATUS),
  
  getSystemResources: () => api.get<SystemResources>(API_ENDPOINTS.SYSTEM_RESOURCES),
  
  // Journal - Not implemented in backend
  // getJournal: (params: { target: 'ui' | 'xray'; limit?: number }) => 
  //   api.get<{ service: string; journal: string; lines: string[]; timezone?: string }>(
  //     API_ENDPOINTS.SYSTEM_JOURNAL, 
  //     { params }
  //   ),
};
