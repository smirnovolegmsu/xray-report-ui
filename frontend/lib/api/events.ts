/**
 * Events-related API endpoints
 */

import { api } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { Event, EventsStatsResponse } from '@/types';

export const eventsApi = {
  getEvents: (params?: { limit?: number }) => 
    api.get<{ events: Event[] }>(API_ENDPOINTS.EVENTS, { params }),
  
  getEventsStats: (hours?: number) =>
    api.get<EventsStatsResponse>(API_ENDPOINTS.EVENTS_STATS, { params: { hours } }),
};
