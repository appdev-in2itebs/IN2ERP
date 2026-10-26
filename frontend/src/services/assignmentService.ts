import { apiClient } from './apiClient';
import { Assignment, AssignmentCreatePayload, AssignmentUpdatePayload } from '@/types';

export const assignmentService = {
  getUserAssignments: async (userId: string): Promise<Assignment[]> => {
    return apiClient.get<Assignment[]>(`/assignments/user/${userId}`);
  },

  createAssignment: async (payload: AssignmentCreatePayload): Promise<Assignment> => {
    return apiClient.post<Assignment>('/assignments', payload);
  },

  updateAssignment: async (id: string, payload: AssignmentUpdatePayload): Promise<Assignment> => {
    return apiClient.patch<Assignment>(`/assignments/${id}`, payload);
  },

  deleteAssignment: async (id: string): Promise<void> => {
    return apiClient.delete(`/assignments/${id}`);
  },
};
