"""
In2IT ERP - Audit Service
Recording and retrieval of the audit trail.
"""

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.request_context import client_ip_var, correlation_id_var, user_agent_var
from app.models.audit import AuditLog
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditLogListResponse, AuditLogResponse


async def record_audit(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str,
    actor: User | None = None,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
    status: str = "success",
    actor_id: str | None = None,
    actor_email: str | None = None,
) -> AuditLog:
    """
    Add an audit entry to the current transaction, so it is committed (or rolled back)
    together with the change it describes. Use commit_audit() for failures that are
    followed by an error response.
    """
    log = AuditLog(
        user_id=actor.id if actor else actor_id,
        user_email=actor.email if actor else actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=json.dumps(details, default=str) if details is not None else None,
        ip_address=client_ip_var.get(),
        user_agent=user_agent_var.get(),
        status=status,
        correlation_id=correlation_id_var.get(),
    )
    db.add(log)
    await db.flush()
    return log


async def commit_audit(db: AsyncSession, **kwargs: Any) -> None:
    """
    Record an audit entry and commit immediately. Used before raising an HTTP error,
    because the request session rolls back on exceptions and would discard the entry.
    """
    await record_audit(db, **kwargs)
    await db.commit()


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit_repo = AuditRepository(db)

    async def get_logs(
        self, page: int = 1, per_page: int = 50,
        user_id: str | None = None, action: str | None = None,
        resource_type: str | None = None
    ) -> AuditLogListResponse:
        logs, total = await self.audit_repo.list_logs(
            page=page, per_page=per_page,
            user_id=user_id, action=action, resource_type=resource_type
        )
        return AuditLogListResponse(
            logs=[AuditLogResponse.model_validate(log) for log in logs],
            total=total, page=page, per_page=per_page,
        )
