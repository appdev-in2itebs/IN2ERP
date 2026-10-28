"""
In2IT ERP - User Schemas
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str | None = None
    department: str | None = None
    designation: str | None = None
    avatar_url: str | None = None


class UserCreate(UserBase):
    # Omit to have the server generate a strong one-time password.
    password: str | None = None


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    department: str | None = None
    designation: str | None = None
    avatar_url: str | None = None
    is_active: bool | None = None


class ResetPasswordRequest(BaseModel):
    # Omit to have the server generate a strong one-time password.
    password: str | None = None


class EntraLinkRequest(BaseModel):
    entra_object_id: str
    entra_tenant_id: str

    @field_validator("entra_object_id", "entra_tenant_id")
    @classmethod
    def _guid(cls, value: str) -> str:
        try:
            return str(uuid.UUID(value.strip()))
        except ValueError:
            raise ValueError("Must be a GUID") from None


class UserAppAssignmentDetail(BaseModel):
    application_slug: str
    application_name: str
    app_role: str
    status: str = "active"
    provisioning_status: str = "pending"

    model_config = {"from_attributes": True}


class UserResponse(UserBase):
    id: str
    is_active: bool
    is_superadmin: bool
    must_change_password: bool = False
    entra_linked: bool = False
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None
    locked_until: datetime | None = None
    primary_role: str = "Employee"
    role_names: list[str] = []
    app_assignments: list[UserAppAssignmentDetail] = []

    model_config = {"from_attributes": True}

    @field_validator("app_assignments", mode="before")
    @classmethod
    def _only_effective_assignments(cls, value):
        # Revoked, suspended and expired assignments are history, not current access.
        return [a for a in value or [] if not hasattr(a, "is_effective") or a.is_effective()]


class UserWithTemporaryPassword(UserResponse):
    # Returned exactly once, when an administrator creates a user or resets a password.
    temporary_password: str | None = None


class UserWithRoles(UserResponse):
    auth_method: str = "local"
    roles: list["RoleBasic"] = []
    permissions: list[str] = []


class RoleBasic(BaseModel):
    id: str
    name: str
    color: str | None = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    per_page: int
