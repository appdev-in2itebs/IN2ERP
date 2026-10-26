"""
In2IT ERP - Audit Service
Business logic for audit log retrieval and analytics.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditLogListResponse, AuditLogResponse


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
