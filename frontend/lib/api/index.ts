/**
 * Main API client
 * Combines all API modules into a single apiClient object
 * Maintains backward compatibility with the original apiClient structure
 */

import { api, apiRequest } from './client';
import { usersApi } from './users';
import { dashboardApi } from './dashboard';
import { eventsApi } from './events';
import { liveApi } from './live';
import { settingsApi } from './settings';
import { systemApi } from './system';
import { handleApiError } from '@/lib/utils';

// Combine all API modules into a single client object
export const apiClient = {
  // System
  ...systemApi,
  
  // Settings (includes Xray, Collector, Backups, Tests, Ports)
  ...settingsApi,
  
  // Users
  ...usersApi,
  
  // Dashboard
  ...dashboardApi,
  
  // Live/Online
  ...liveApi,
  
  // Events
  ...eventsApi,
};

// Re-export apiRequest for backward compatibility
export { apiRequest };

// Re-export handleApiError for backward compatibility
export { handleApiError };

// Re-export api instance if needed
export { api };
