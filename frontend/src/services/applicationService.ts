import { apiClient } from './apiClient';
import { Application, ApplicationCreatePayload, ApplicationUpdatePayload } from '@/types';

export const applicationService = {
  listApplications: async (params?: {
    category?: string;
    is_active?: boolean;
  }): Promise<Application[]> => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.is_active !== undefined) query.append('is_active', params.is_active.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<Application[]>(`/applications${qs}`);
  },

  getMyApplications: async (): Promise<Application[]> => {
    return apiClient.get<Application[]>('/applications/my');
  },

  getApplication: async (id: string): Promise<Application> => {
    return apiClient.get<Application>(`/applications/${id}`);
  },

  createApplication: async (payload: ApplicationCreatePayload): Promise<Application> => {
    return apiClient.post<Application>('/applications', payload);
  },

  updateApplication: async (id: string, payload: ApplicationUpdatePayload): Promise<Application> => {
    return apiClient.patch<Application>(`/applications/${id}`, payload);
  },

  deleteApplication: async (id: string): Promise<void> => {
    return apiClient.delete(`/applications/${id}`);
  },
};
