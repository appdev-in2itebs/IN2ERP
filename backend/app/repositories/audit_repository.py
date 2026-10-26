"""
In2IT ERP - Audit Repository
Data access layer for AuditLog model.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


class AuditRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, log: AuditLog) -> AuditLog:
        self.db.add(log)
        await self.db.flush()
        return log

    async def list_logs(
        self, page: int = 1, per_page: int = 50,
        user_id: str | None = None, action: str | None = None,
        resource_type: str | None = None
    ) -> tuple[list[AuditLog], int]:
        query = select(AuditLog)
        count_query = select(func.count(AuditLog.id))

        if user_id:
            query = query.where(AuditLog.user_id == user_id)
            count_query = count_query.where(AuditLog.user_id == user_id)
        if action:
            query = query.where(AuditLog.action == action)
            count_query = count_query.where(AuditLog.action == action)
        if resource_type:
            query = query.where(AuditLog.resource_type == resource_type)
            count_query = count_query.where(AuditLog.resource_type == resource_type)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        query = query.order_by(AuditLog.timestamp.desc())
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await self.db.execute(query)
        logs = list(result.scalars().all())

        return logs, total

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(AuditLog.id)))
        return result.scalar()
