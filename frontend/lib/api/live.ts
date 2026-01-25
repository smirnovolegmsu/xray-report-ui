/**
 * Live/Online-related API endpoints
 */

import { api } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { LiveNowResponse, LiveSeriesResponse, LiveTopResponse } from '@/types';

export const liveApi = {
  getLiveNow: () => api.get<LiveNowResponse>(API_ENDPOINTS.LIVE_NOW),
  
  getLiveSeries: (params: {
    metric: 'conns' | 'traffic' | 'online_users';
    period: string;
    gran: string;
    scope: string;
  }) => api.get<LiveSeriesResponse>(API_ENDPOINTS.LIVE_SERIES, { params }),
  
  getLiveTop: (params: {
    metric: 'conns' | 'traffic';
    period: string;
    scope: string;
  }) => api.get<LiveTopResponse>(API_ENDPOINTS.LIVE_TOP, { params }),
};
