export type IntegrationType = 'manual' | 'entra_app_roles' | 'scim' | 'custom_api';
export type IntegrationStatus = 'manual' | 'unconfigured' | 'configured' | 'healthy' | 'error';
export type AuthMethod = 'entra_sso' | 'oidc' | 'saml' | 'local' | 'other';

export interface ConnectorConfig {
  service_principal_id?: string;
  tenant_id?: string;
  client_id?: string;
  base_url?: string;
}

export interface AppRole {
  id: string;
  application_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  external_role_id?: string | null;
  is_default: boolean;
  sort_order: number;
  source: 'manual' | 'connector';
  sync_status: 'unverified' | 'verified' | 'missing';
  synced_at?: string | null;
  created_at: string;
}

export interface AppRolePayload {
  name: string;
  code?: string | null;
  description?: string | null;
  external_role_id?: string | null;
  is_default?: boolean;
  sort_order?: number;
}

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
  auth_method: AuthMethod;
  integration_type: IntegrationType;
  integration_status: IntegrationStatus;
  connector_config: ConnectorConfig;
  connector_secret_ref?: string | null;
  last_connection_test_at?: string | null;
  last_connection_error?: string | null;
  roles: AppRole[];
  created_at: string;
  updated_at: string;
  assigned_users?: number;
}

/** An application on the employee launchpad. `url` is only set once access is verified. */
export interface MyApplication {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  category?: string | null;
  url?: string | null;
  roles: string[];
  access_state: 'ready' | 'pending' | 'failed';
  status_message?: string | null;
}

export interface ApplicationCreatePayload {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  url?: string | null;
  category?: string;
  is_core?: boolean;
  requires_license?: boolean;
  max_users?: number | null;
  sort_order?: number;
  auth_method?: AuthMethod;
  integration_type?: IntegrationType;
  connector_config?: ConnectorConfig | null;
  connector_secret_ref?: string | null;
  roles?: AppRolePayload[];
}

export type ApplicationUpdatePayload = Partial<Omit<ApplicationCreatePayload, 'slug' | 'roles' | 'is_core'>> & {
  is_active?: boolean;
};

export interface ConnectionTestResult {
  ok: boolean;
  integration_status: IntegrationStatus;
  message: string;
}

export interface RoleSyncResult {
  added: string[];
  updated: string[];
  missing: string[];
  roles: AppRole[];
}

export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  manual: 'Manual (app owner confirms)',
  entra_app_roles: 'Microsoft Entra app roles',
  scim: 'SCIM 2.0',
  custom_api: 'In2ERP provisioning API',
};
