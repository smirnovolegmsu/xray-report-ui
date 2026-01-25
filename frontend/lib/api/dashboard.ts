/**
 * Dashboard and usage-related API endpoints
 */

import { api } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { DashboardApiResponse, UsageDashboardResponse, ApiResponse } from '@/types';

export const dashboardApi = {
  getDashboard: (params?: { days?: number; user?: string }) => 
    api.get<DashboardApiResponse>(API_ENDPOINTS.USAGE_DASHBOARD, { 
      params: {
        days: params?.days,
        user: params?.user,
      }
    }),
  
  getUsageDates: () => api.get<{ dates: string[] }>(API_ENDPOINTS.USAGE_DATES),
  
  getUsageDashboard: (date: string, params?: {
    mode?: 'daily' | 'cumulative';
    window_days?: number;
  }) => {
    // Backend expects date as path parameter: /api/usage/dashboard/<date>
    const url = `${API_ENDPOINTS.USAGE_DASHBOARD}/${date}`;
    return api.get<UsageDashboardResponse>(url, { 
      params: {
        mode: params?.mode,
        window_days: params?.window_days,
      }
    });
  },
};
