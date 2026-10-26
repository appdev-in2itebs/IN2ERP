import { apiClient } from './apiClient';
import { AuditLogListResponse } from '@/types';

export const auditService = {
  listLogs: async (params?: {
    page?: number;
    per_page?: number;
    user_id?: string;
    action?: string;
    resource_type?: string;
  }): Promise<AuditLogListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.per_page) query.append('per_page', params.per_page.toString());
    if (params?.user_id) query.append('user_id', params.user_id);
    if (params?.action) query.append('action', params.action);
    if (params?.resource_type) query.append('resource_type', params.resource_type);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<AuditLogListResponse>(`/audit${qs}`);
  },
};
