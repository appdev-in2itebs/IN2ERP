export interface Application {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  url?: string | null;
  category?: string | null;
  is_active: boolean;
  is_core: boolean;
  requires_license: boolean;
  max_users?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  assigned_users?: number;
  user_app_role?: string;
}

export interface ApplicationCreatePayload {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  url?: string;
  category?: string;
  is_core?: boolean;
  requires_license?: boolean;
  max_users?: number | null;
  sort_order?: number;
}

export interface ApplicationUpdatePayload {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  url?: string;
  category?: string;
  is_active?: boolean;
  requires_license?: boolean;
  max_users?: number | null;
  sort_order?: number;
}
