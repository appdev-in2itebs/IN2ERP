import { apiClient } from './apiClient';
import { Permission, Role, RoleCreatePayload, RoleUpdatePayload } from '@/types';

export const roleService = {
  listRoles: async (): Promise<Role[]> => {
    return apiClient.get<Role[]>('/roles');
  },

  listPermissions: async (module?: string): Promise<Permission[]> => {
    const qs = module ? `?module=${encodeURIComponent(module)}` : '';
    return apiClient.get<Permission[]>(`/roles/permissions${qs}`);
  },

  createRole: async (payload: RoleCreatePayload): Promise<Role> => {
    return apiClient.post<Role>('/roles', payload);
  },

  updateRole: async (id: string, payload: RoleUpdatePayload): Promise<Role> => {
    return apiClient.patch<Role>(`/roles/${id}`, payload);
  },

  deleteRole: async (id: string): Promise<void> => {
    return apiClient.delete(`/roles/${id}`);
  },

  assignRoleToUser: async (userId: string, roleId: string): Promise<void> => {
    return apiClient.post('/roles/assign', { user_id: userId, role_id: roleId });
  },

  unassignRoleFromUser: async (userId: string, roleId: string): Promise<void> => {
    return apiClient.delete(`/roles/assign/${userId}/${roleId}`);
  },

  setPermissionOverride: async (
    userId: string,
    permissionId: string,
    isGranted: boolean,
    reason?: string
  ): Promise<void> => {
    return apiClient.post('/roles/overrides', {
      user_id: userId,
      permission_id: permissionId,
      is_granted: isGranted,
      reason,
    });
  },

  removePermissionOverride: async (userId: string, permissionId: string): Promise<void> => {
    return apiClient.delete(`/roles/overrides/${userId}/${permissionId}`);
  },
};
