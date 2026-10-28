import { apiClient } from './apiClient';
import { AuthConfig, TokenResponse, User } from '@/types';

export const authService = {
  getConfig: (): Promise<AuthConfig> => apiClient.get<AuthConfig>('/auth/config'),

  login: async (email: string, password: string): Promise<TokenResponse> => {
    const data = await apiClient.post<TokenResponse>('/auth/login', { email, password });
    apiClient.setAccessToken(data.access_token);
    return data;
  },

  /** Restore a password session from the HttpOnly refresh cookie (e.g. after a reload). */
  restoreLocalSession: async (): Promise<boolean> => !!(await apiClient.refreshLocalSession()),

  changePassword: async (currentPassword: string, newPassword: string): Promise<TokenResponse> => {
    const data = await apiClient.post<TokenResponse>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    apiClient.setAccessToken(data.access_token);
    return data;
  },

  getCurrentUser: (): Promise<User> => apiClient.get<User>('/auth/me'),

  /** Revokes every session server-side, then forgets the in-memory token. */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      apiClient.clear();
    }
  },
};
