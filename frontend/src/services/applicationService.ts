import { apiClient } from './apiClient';
import {
  AppRole,
  AppRolePayload,
  Application,
  ApplicationCreatePayload,
  ApplicationUpdatePayload,
  ConnectionTestResult,
  MyApplication,
  RoleSyncResult,
} from '@/types';

export const applicationService = {
  listApplications: async (params?: { category?: string; is_active?: boolean }): Promise<Application[]> => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.is_active !== undefined) query.append('is_active', params.is_active.toString());
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<Application[]>(`/applications${qs}`);
  },

  /** The signed-in employee's launchpad. */
  getMyApplications: (): Promise<MyApplication[]> => apiClient.get<MyApplication[]>('/applications/my'),

  getApplication: (id: string): Promise<Application> => apiClient.get<Application>(`/applications/${id}`),

  createApplication: (payload: ApplicationCreatePayload): Promise<Application> =>
    apiClient.post<Application>('/applications', payload),

  updateApplication: (id: string, payload: ApplicationUpdatePayload): Promise<Application> =>
    apiClient.patch<Application>(`/applications/${id}`, payload),

  deleteApplication: (id: string): Promise<void> => apiClient.delete(`/applications/${id}`),

  testConnection: (id: string): Promise<ConnectionTestResult> =>
    apiClient.post<ConnectionTestResult>(`/applications/${id}/test-connection`),

  syncRoles: (id: string): Promise<RoleSyncResult> =>
    apiClient.post<RoleSyncResult>(`/applications/${id}/roles/sync`),

  createRole: (appId: string, payload: AppRolePayload): Promise<AppRole> =>
    apiClient.post<AppRole>(`/applications/${appId}/roles`, payload),

  updateRole: (appId: string, roleId: string, payload: Partial<AppRolePayload>): Promise<AppRole> =>
    apiClient.patch<AppRole>(`/applications/${appId}/roles/${roleId}`, payload),

  deleteRole: (appId: string, roleId: string): Promise<void> =>
    apiClient.delete(`/applications/${appId}/roles/${roleId}`),

  /** Manual applications: the app owner confirms every pending change at once. */
  confirmManualChanges: (appId: string, note?: string): Promise<{ confirmed: number }> =>
    apiClient.post(`/applications/${appId}/confirm-manual`, { note }),
};
