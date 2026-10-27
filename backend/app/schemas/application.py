"""
In2IT ERP - Application & Assignment Schemas
"""

from datetime import datetime
from pydantic import BaseModel


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
    created_at: datetime
    updated_at: datetime
    assigned_users: int = 0
    user_app_role: str | None = None

    model_config = {"from_attributes": True}


class AssignmentCreate(BaseModel):
    user_id: str
    application_id: str
    app_role: str = "Member"
    notes: str | None = None
    expires_at: datetime | None = None


class AssignmentUpdate(BaseModel):
    status: str | None = None
    app_role: str | None = None
    notes: str | None = None
    expires_at: datetime | None = None


class AssignmentResponse(BaseModel):
    id: str
    user_id: str
    application_id: str
    app_role: str = "Member"
    status: str
    assigned_at: datetime
    assigned_by: str | None = None
    expires_at: datetime | None = None
    notes: str | None = None
    user_name: str | None = None
    user_email: str | None = None
    application_name: str | None = None

    model_config = {"from_attributes": True}


class UserAssignmentSyncItem(BaseModel):
    application_id: str | None = None
    application_slug: str | None = None
    app_role: str = "Member"
    status: str = "active"


class UserAssignmentSyncRequest(BaseModel):
    assignments: list[UserAssignmentSyncItem] = []
    department: str | None = None
    designation: str | None = None
    phone: str | None = None
    is_active: bool | None = None
