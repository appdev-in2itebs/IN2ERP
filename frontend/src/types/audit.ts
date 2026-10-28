export interface AuditLog {
  id: string;
  timestamp: string;
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  status: 'success' | 'failure';
  correlation_id?: string | null;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  per_page: number;
}
