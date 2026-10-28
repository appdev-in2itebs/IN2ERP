import { apiClient } from './apiClient';
import { User, UserCreatePayload, UserListResponse, UserUpdatePayload, UserWithTemporaryPassword } from '@/types';

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

  /** The response carries a one-time password, shown to the admin exactly once. */
  createUser: async (payload: UserCreatePayload): Promise<UserWithTemporaryPassword> => {
    return apiClient.post<UserWithTemporaryPassword>('/users', payload);
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

  /** Server generates a one-time password unless one is given; sessions are revoked. */
  resetPassword: async (id: string, password?: string): Promise<UserWithTemporaryPassword> => {
    return apiClient.post<UserWithTemporaryPassword>(`/users/${id}/reset-password`, password ? { password } : {});
  },

  revokeSessions: async (id: string): Promise<void> => {
    return apiClient.post(`/users/${id}/revoke-sessions`);
  },

  linkEntra: async (id: string, entraObjectId: string, entraTenantId: string): Promise<User> => {
    return apiClient.put<User>(`/users/${id}/entra-link`, {
      entra_object_id: entraObjectId,
      entra_tenant_id: entraTenantId,
    });
  },

  unlinkEntra: async (id: string): Promise<User> => {
    return apiClient.delete<User>(`/users/${id}/entra-link`);
  },
};
