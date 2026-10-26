import { apiClient } from './apiClient';
import { TokenResponse, User } from '@/types';

export const authService = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    const data = await apiClient.post<TokenResponse>('/auth/login', { email, password });
    apiClient.setTokens(data.access_token, data.refresh_token);
    return data;
  },

  register: async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    department?: string;
    designation?: string;
  }): Promise<TokenResponse> => {
    const data = await apiClient.post<TokenResponse>('/auth/register', payload);
    apiClient.setTokens(data.access_token, data.refresh_token);
    return data;
  },

  getCurrentUser: async (): Promise<User> => {
    return apiClient.get<User>('/auth/me');
  },

  logout: () => {
    apiClient.clearTokens();
  },
};
