export interface UserAppAssignmentDetail {
  application_slug: string;
  application_name: string;
  app_role: string;
  status: string;
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
  password: string;
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

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
}
