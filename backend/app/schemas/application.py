"""
In2IT ERP - Application, App Role, Access & Provisioning Schemas
"""

import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from app.integrations.secrets import is_valid_secret_ref

IntegrationType = Literal["manual", "entra_app_roles", "scim", "custom_api"]
AuthMethod = Literal["entra_sso", "oidc", "saml", "local", "other"]

# Keys allowed in connector_config. Secrets never go here; use connector_secret_ref.
CONNECTOR_CONFIG_KEYS = {"service_principal_id", "tenant_id", "client_id", "base_url", "allow_http"}


def _validate_launch_url(value: str | None) -> str | None:
    """Launch URLs must be an absolute http(s) URL or an internal path."""
    if value is None or value.strip() == "":
        return None
    value = value.strip()
    if "\\" in value or any(ord(c) < 32 for c in value):
        raise ValueError("URL contains invalid characters")
    # Internal paths only; "//host" is a protocol-relative external URL.
    if value.startswith("/") and not value.startswith("//"):
        return value
    if value.lower().startswith(("https://", "http://")):
        return value
    raise ValueError("URL must start with https://, http:// or /")


def _validate_connector_config(value: dict | None) -> dict | None:
    if value is None:
        return None
    unknown = set(value) - CONNECTOR_CONFIG_KEYS
    if unknown:
        raise ValueError(
            f"Unsupported connector settings: {', '.join(sorted(unknown))}. "
            "Store credentials in a secret and set connector_secret_ref instead."
        )
    return value


def _validate_secret_ref(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    if not is_valid_secret_ref(value):
        raise ValueError("connector_secret_ref must be a secret name such as INVENTORY_API_TOKEN")
    return value


# ── Application roles ──

class AppRoleBase(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None
    external_role_id: str | None = None
    is_default: bool = False
    sort_order: int = 0

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Role name is required")
        return value


class AppRoleCreate(AppRoleBase):
    pass


class AppRoleUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    external_role_id: str | None = None
    is_default: bool | None = None
    sort_order: int | None = None


class AppRoleResponse(AppRoleBase):
    id: str
    application_id: str
    source: str = "manual"
    sync_status: str = "unverified"
    synced_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Applications ──

class ApplicationCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    url: str | None = None
    category: str | None = None
    is_core: bool = False
    requires_license: bool = False
    max_users: int | None = None
    sort_order: int = 0
    auth_method: AuthMethod = "entra_sso"
    integration_type: IntegrationType = "manual"
    connector_config: dict | None = None
    connector_secret_ref: str | None = None
    roles: list[AppRoleCreate] = []

    @field_validator("url")
    @classmethod
    def _check_url(cls, value: str | None) -> str | None:
        return _validate_launch_url(value)

    @field_validator("connector_config")
    @classmethod
    def _check_config(cls, value: dict | None) -> dict | None:
        return _validate_connector_config(value)

    @field_validator("connector_secret_ref")
    @classmethod
    def _check_secret_ref(cls, value: str | None) -> str | None:
        return _validate_secret_ref(value)

    @field_validator("slug")
    @classmethod
    def _normalise_slug(cls, value: str) -> str:
        slug = "-".join(value.strip().lower().split())
        if not slug:
            raise ValueError("Slug is required")
        return slug


class ApplicationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    url: str | None = None
    category: str | None = None
    is_active: bool | None = None
    requires_license: bool | None = None
    max_users: int | None = None
    sort_order: int | None = None
    auth_method: AuthMethod | None = None
    integration_type: IntegrationType | None = None
    connector_config: dict | None = None
    connector_secret_ref: str | None = None

    @field_validator("url")
    @classmethod
    def _check_url(cls, value: str | None) -> str | None:
        return _validate_launch_url(value)

    @field_validator("connector_config")
    @classmethod
    def _check_config(cls, value: dict | None) -> dict | None:
        return _validate_connector_config(value)

    @field_validator("connector_secret_ref")
    @classmethod
    def _check_secret_ref(cls, value: str | None) -> str | None:
        return _validate_secret_ref(value)


class ApplicationResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    url: str | None = None
    category: str | None = None
    is_active: bool
    is_core: bool
    requires_license: bool
    max_users: int | None = None
    sort_order: int
    auth_method: str = "entra_sso"
    integration_type: str = "manual"
    integration_status: str = "manual"
    connector_config: dict = {}
    connector_secret_ref: str | None = None
    last_connection_test_at: datetime | None = None
    last_connection_error: str | None = None
    roles: list[AppRoleResponse] = []
    created_at: datetime
    updated_at: datetime
    assigned_users: int = 0

    model_config = {"from_attributes": True}

    @field_validator("connector_config", mode="before")
    @classmethod
    def _parse_config(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except ValueError:
                return {}
        return value or {}


class MyApplicationResponse(BaseModel):
    """An application on the employee launchpad."""
    id: str
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    category: str | None = None
    # Only present once access is verified; nothing to open before that.
    url: str | None = None
    roles: list[str] = []
    access_state: Literal["ready", "pending", "failed"]
    status_message: str | None = None


class RoleSyncResult(BaseModel):
    added: list[str] = []
    updated: list[str] = []
    missing: list[str] = []
    roles: list[AppRoleResponse] = []


class ConnectionTestResult(BaseModel):
    ok: bool
    integration_status: str
    message: str


# ── Assignments & access changes ──

class AssignmentCreate(BaseModel):
    user_id: str
    application_id: str
    app_role_id: str
    notes: str | None = None
    expires_at: datetime | None = None


class AssignmentUpdate(BaseModel):
    """Notes and expiry only; changing a role is a revoke plus a grant."""
    notes: str | None = None
    expires_at: datetime | None = None


class ManualConfirmRequest(BaseModel):
    note: str | None = None


class AssignmentResponse(BaseModel):
    id: str
    user_id: str
    application_id: str
    app_role_id: str | None = None
    app_role: str = "Member"
    status: str
    provisioning_status: str
    last_error: str | None = None
    last_verified_at: datetime | None = None
    assigned_at: datetime
    assigned_by: str | None = None
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    notes: str | None = None
    user_name: str | None = None
    user_email: str | None = None
    application_name: str | None = None
    integration_type: str | None = None

    model_config = {"from_attributes": True}


class GrantItem(BaseModel):
    application_id: str
    app_role_id: str
    expires_at: datetime | None = None
    notes: str | None = None


class AccessChangeRequest(BaseModel):
    """Explicit grants and revocations for one employee. Nothing is implied by omission."""
    grants: list[GrantItem] = []
    revokes: list[str] = []  # assignment ids
    dry_run: bool = False


class PlannedChangeResponse(BaseModel):
    action: str
    application_id: str
    application_name: str
    app_role_id: str
    app_role: str
    assignment_id: str | None = None
    expires_at: datetime | None = None
    integration_type: str
    outcome: str


class AccessChangeResponse(BaseModel):
    dry_run: bool
    changes: list[PlannedChangeResponse]
    assignments: list[AssignmentResponse] = []


class ProvisioningJobResponse(BaseModel):
    id: str
    assignment_id: str
    application_id: str
    operation: str
    status: str
    attempts: int
    max_attempts: int
    next_attempt_at: datetime
    last_error: str | None = None
    correlation_id: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}
