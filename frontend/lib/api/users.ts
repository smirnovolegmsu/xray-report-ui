/**
 * User-related API endpoints
 */

import { api } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { User, UserStats, UserLink, ApiResponse } from '@/types';

export const usersApi = {
  getUsers: () => api.get<{ users: User[] }>(API_ENDPOINTS.USERS),
  
  addUser: (email: string) => 
    api.post<ApiResponse>(API_ENDPOINTS.USERS_ADD, { email }),
  
  deleteUser: (email: string) => 
    api.post<ApiResponse>(API_ENDPOINTS.USERS_DELETE, { email }),
  
  kickUser: (email: string) => 
    api.post<ApiResponse>(API_ENDPOINTS.USERS_KICK, { email }),
  
  getUserLink: (uuid: string, email: string) => 
    api.get<UserLink>(API_ENDPOINTS.USERS_LINK, { params: { uuid, email } }),
  
  getUserStats: (uuid?: string) => 
    api.get<{ users: UserStats[] }>(API_ENDPOINTS.USERS_STATS, { params: { uuid } }),
  
  updateUserAlias: (email: string, alias: string) =>
    api.post<ApiResponse>(API_ENDPOINTS.USERS_UPDATE_ALIAS, { email, alias }),
};
