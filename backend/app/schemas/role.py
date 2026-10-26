"""
In2IT ERP - Role & Permission Schemas
"""

from datetime import datetime
from pydantic import BaseModel


class PermissionResponse(BaseModel):
    id: str
    code: str
    name: str
    description: str | None = None
    module: str

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    permission_ids: list[str] = []


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    permission_ids: list[str] | None = None


class RoleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_system: bool
    color: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoleWithPermissions(RoleResponse):
    permissions: list[PermissionResponse] = []
    user_count: int = 0


class AssignRoleRequest(BaseModel):
    user_id: str
    role_id: str


class PermissionOverrideRequest(BaseModel):
    user_id: str
    permission_id: str
    is_granted: bool
    reason: str | None = None
