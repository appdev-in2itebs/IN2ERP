"""
In2IT ERP - Audit Log Schemas
"""

from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    timestamp: datetime
    user_id: str | None = None
    user_email: str | None = None
    action: str
    resource_type: str
    resource_id: str | None = None
    details: str | None = None
    ip_address: str | None = None
    status: str

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int
    page: int
    per_page: int
