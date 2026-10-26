export interface Assignment {
  id: string;
  user_id: string;
  application_id: string;
  app_role?: string;
  status: 'active' | 'suspended' | 'pending';
  assigned_at: string;
  assigned_by?: string | null;
  expires_at?: string | null;
  notes?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  application_name?: string | null;
}

export interface AssignmentCreatePayload {
  user_id: string;
  application_id: string;
  app_role?: string;
  notes?: string;
  expires_at?: string | null;
}

export interface AssignmentUpdatePayload {
  status?: string;
  app_role?: string;
  notes?: string;
  expires_at?: string | null;
}
