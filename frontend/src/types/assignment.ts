export type AssignmentStatus = 'active' | 'revoked' | 'expired';

export type ProvisioningStatus =
  | 'pending'
  | 'applied'
  | 'verified'
  | 'failed'
  | 'revocation_pending'
  | 'revoked'
  | 'reconciliation_required'
  | 'manual_action_required';

/** One application role held by one employee. */
export interface Assignment {
  id: string;
  user_id: string;
  application_id: string;
  app_role_id?: string | null;
  app_role: string;
  status: AssignmentStatus;
  provisioning_status: ProvisioningStatus;
  last_error?: string | null;
  last_verified_at?: string | null;
  assigned_at: string;
  assigned_by?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  notes?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  application_name?: string | null;
  integration_type?: string | null;
}

export interface GrantItem {
  application_id: string;
  app_role_id: string;
  expires_at?: string | null;
  notes?: string | null;
}

export interface AccessChangeRequest {
  grants: GrantItem[];
  revokes: string[];
  dry_run?: boolean;
}

export interface PlannedChange {
  action: 'grant' | 'revoke';
  application_id: string;
  application_name: string;
  app_role_id: string;
  app_role: string;
  assignment_id?: string | null;
  expires_at?: string | null;
  integration_type: string;
  outcome: string;
}

export interface AccessChangeResponse {
  dry_run: boolean;
  changes: PlannedChange[];
  assignments: Assignment[];
}

export interface AssignmentCreatePayload {
  user_id: string;
  application_id: string;
  app_role_id: string;
  notes?: string;
  expires_at?: string | null;
}

export interface AssignmentUpdatePayload {
  notes?: string;
  expires_at?: string | null;
}

export interface ProvisioningJob {
  id: string;
  assignment_id: string;
  application_id: string;
  operation: 'grant' | 'revoke' | 'verify';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'superseded' | 'manual';
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error?: string | null;
  correlation_id?: string | null;
  created_at: string;
  completed_at?: string | null;
}

/** Human-readable label and tone for each provisioning status. */
export const PROVISIONING_LABELS: Record<ProvisioningStatus, { label: string; tone: 'ok' | 'wait' | 'warn' | 'bad' | 'muted' }> = {
  pending: { label: 'Pending', tone: 'wait' },
  applied: { label: 'Applied, verifying', tone: 'wait' },
  verified: { label: 'Verified', tone: 'ok' },
  failed: { label: 'Failed', tone: 'bad' },
  revocation_pending: { label: 'Revocation pending', tone: 'wait' },
  revoked: { label: 'Revoked', tone: 'muted' },
  reconciliation_required: { label: 'Reconciliation required', tone: 'warn' },
  manual_action_required: { label: 'Awaiting app owner', tone: 'warn' },
};
