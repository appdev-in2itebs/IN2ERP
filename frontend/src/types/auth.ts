/** The access token is kept in memory; the refresh token lives in an HttpOnly cookie. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  must_change_password: boolean;
}

export interface EntraClientConfig {
  client_id: string;
  authority: string;
  api_scope: string;
}

export interface AuthConfig {
  self_registration_enabled: boolean;
  password_min_length: number;
  local_login_enabled: boolean;
  entra_enabled: boolean;
  entra?: EntraClientConfig | null;
}
