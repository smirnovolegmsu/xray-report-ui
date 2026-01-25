/**
 * Axios instance and base API client configuration
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG } from '@/lib/constants/api';
import { devLog } from '@/lib/utils';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.DEFAULT_HEADERS,
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    devLog.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.params || '');
    return config;
  },
  (error) => {
    devLog.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    devLog.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - Success`, response.status);
    return response;
  },
  (error: AxiosError) => {
    // Log detailed error information
    if (error.response) {
      // Server responded with error status
      devLog.error(
        `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} - Error ${error.response.status}`,
        error.response.data
      );
    } else if (error.request) {
      // Request was made but no response received
      devLog.error(
        `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} - No response`,
        'Network error or backend unavailable'
      );
      // Enhance error with more context
      error.message = error.message || 'Network error: Backend server is not responding';
    } else {
      // Something else happened
      devLog.error('[API] Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

/**
 * Generic request method (exported separately to avoid TypeScript issues)
 */
export function apiRequest<T = any>(url: string, options?: any) {
  return api.get<T>(url, options);
}
