export interface UserAppAssignmentDetail {
  application_slug: string;
  application_name: string;
  app_role: string;
  status: string;
  provisioning_status?: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  must_change_password?: boolean;
  entra_linked?: boolean;
  auth_method?: 'local' | 'entra';
  locked_until?: string | null;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  primary_role?: string;
  role_names?: string[];
  app_assignments?: UserAppAssignmentDetail[];
  roles?: { id: string; name: string; color?: string | null }[];
  permissions?: string[];
}

export interface UserCreatePayload {
  email: string;
  /** Omit to let the server generate a one-time password. */
  password?: string;
  first_name: string;
  last_name: string;
  phone?: string;
  department?: string;
  designation?: string;
  avatar_url?: string;
}

export interface UserUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  designation?: string;
  avatar_url?: string;
  is_active?: boolean;
}

/** Returned once when an admin creates a user or resets a password. */
export interface UserWithTemporaryPassword extends User {
  temporary_password?: string | null;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
}
