export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  module: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  color?: string | null;
  created_at: string;
  updated_at: string;
  permissions?: Permission[];
  user_count?: number;
}

export interface RoleCreatePayload {
  name: string;
  description?: string;
  color?: string;
  permission_ids?: string[];
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string;
  color?: string;
  permission_ids?: string[];
}
