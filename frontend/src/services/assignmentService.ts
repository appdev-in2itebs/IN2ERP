import { apiClient } from './apiClient';
import {
  AccessChangeRequest,
  AccessChangeResponse,
  Assignment,
  AssignmentCreatePayload,
  AssignmentUpdatePayload,
  ProvisioningJob,
} from '@/types';

export const assignmentService = {
  getUserAssignments: (userId: string, includeHistory = false): Promise<Assignment[]> =>
    apiClient.get<Assignment[]>(`/assignments/user/${userId}${includeHistory ? '?include_history=true' : ''}`),

  /** Explicit grants and revocations. Use `dry_run: true` to review before applying. */
  changeAccess: (userId: string, request: AccessChangeRequest): Promise<AccessChangeResponse> =>
    apiClient.post<AccessChangeResponse>(`/assignments/user/${userId}/changes`, request),

  createAssignment: (payload: AssignmentCreatePayload): Promise<Assignment> =>
    apiClient.post<Assignment>('/assignments', payload),

  updateAssignment: (id: string, payload: AssignmentUpdatePayload): Promise<Assignment> =>
    apiClient.patch<Assignment>(`/assignments/${id}`, payload),

  /** Starts a revocation; the response shows its pending status. */
  revokeAssignment: (id: string): Promise<Assignment> => apiClient.delete<Assignment>(`/assignments/${id}`),

  retry: (id: string): Promise<Assignment> => apiClient.post<Assignment>(`/assignments/${id}/retry`),

  confirmManual: (id: string, note?: string): Promise<Assignment> =>
    apiClient.post<Assignment>(`/assignments/${id}/confirm`, { note }),

  listJobs: (params?: { status?: string; assignment_id?: string }): Promise<ProvisioningJob[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.assignment_id) query.append('assignment_id', params.assignment_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<ProvisioningJob[]>(`/provisioning/jobs${qs}`);
  },

  runProvisioning: (): Promise<{ expired: number; jobs: Record<string, number> }> =>
    apiClient.post('/provisioning/run'),
};
