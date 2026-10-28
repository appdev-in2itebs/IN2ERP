"""
In2IT ERP - Auth Schemas
Request/response models for authentication endpoints.
"""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """The access token is returned in the body and kept in memory by the SPA.
    The refresh token is only ever sent as an HttpOnly cookie."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    must_change_password: bool = False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    department: str | None = None
    designation: str | None = None
    phone: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class EntraClientConfig(BaseModel):
    """Public values the SPA needs to start an MSAL sign-in. No secrets."""
    client_id: str
    authority: str
    api_scope: str


class AuthConfigResponse(BaseModel):
    self_registration_enabled: bool
    password_min_length: int
    local_login_enabled: bool
    entra_enabled: bool
    entra: EntraClientConfig | None = None
