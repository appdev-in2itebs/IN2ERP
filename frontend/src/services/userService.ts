import { apiClient } from './apiClient';
import { User, UserCreatePayload, UserListResponse, UserUpdatePayload } from '@/types';

export const userService = {
  listUsers: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    department?: string;
    is_active?: boolean;
  }): Promise<UserListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.per_page) query.append('per_page', params.per_page.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.department) query.append('department', params.department);
    if (params?.is_active !== undefined) query.append('is_active', params.is_active.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<UserListResponse>(`/users${qs}`);
  },

  getUser: async (id: string): Promise<User> => {
    return apiClient.get<User>(`/users/${id}`);
  },

  createUser: async (payload: UserCreatePayload): Promise<User> => {
    return apiClient.post<User>('/users', payload);
  },

  updateUser: async (id: string, payload: UserUpdatePayload): Promise<User> => {
    return apiClient.patch<User>(`/users/${id}`, payload);
  },

  deleteUser: async (id: string): Promise<void> => {
    return apiClient.delete(`/users/${id}`);
  },

  getDepartments: async (): Promise<string[]> => {
    return apiClient.get<string[]>('/users/departments');
  },
};
