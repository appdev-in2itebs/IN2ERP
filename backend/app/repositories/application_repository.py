"""
In2IT ERP - Application Repository
Data access layer for Application, AppRole and AppAssignment models.
"""

from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import AppAssignment, AppRole, Application


def effective_filter():
    """SQL condition matching assignments the ERP currently intends (active, unexpired)."""
    now = datetime.now(timezone.utc)
    return (AppAssignment.status == "active") & or_(
        AppAssignment.expires_at.is_(None), AppAssignment.expires_at > now
    )


def _assignment_options():
    return (
        selectinload(AppAssignment.user),
        selectinload(AppAssignment.role),
        selectinload(AppAssignment.application).selectinload(Application.roles),
    )


class ApplicationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Applications ──
    async def get_by_id(self, app_id: str) -> Application | None:
        result = await self.db.execute(
            select(Application)
            .options(selectinload(Application.roles))
            .where(Application.id == app_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Application | None:
        result = await self.db.execute(
            select(Application)
            .options(selectinload(Application.roles))
            .where(Application.slug == slug)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Application | None:
        result = await self.db.execute(select(Application).where(Application.name == name))
        return result.scalar_one_or_none()

    async def list_applications(
        self, category: str | None = None, is_active: bool | None = None
    ) -> list[Application]:
        query = select(Application).options(selectinload(Application.roles))
        if category:
            query = query.where(Application.category == category)
        if is_active is not None:
            query = query.where(Application.is_active == is_active)
        query = query.order_by(Application.sort_order, Application.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, app: Application) -> Application:
        self.db.add(app)
        await self.db.flush()
        return app

    async def update(self, app: Application, data: dict) -> Application:
        for key, value in data.items():
            if value is not None:
                setattr(app, key, value)
        await self.db.flush()
        return app

    async def delete(self, app: Application) -> None:
        await self.db.delete(app)
        await self.db.flush()

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(Application.id)))
        return result.scalar()

    async def count_active(self) -> int:
        result = await self.db.execute(
            select(func.count(Application.id)).where(Application.is_active == True)
        )
        return result.scalar()

    async def get_assigned_user_count(self, app_id: str) -> int:
        """Distinct employees with at least one effective role in the application."""
        result = await self.db.execute(
            select(func.count(func.distinct(AppAssignment.user_id)))
            .where(AppAssignment.application_id == app_id)
            .where(effective_filter())
        )
        return result.scalar()

    # ── Application roles ──
    async def get_app_role(self, app_id: str, role_id: str) -> AppRole | None:
        result = await self.db.execute(
            select(AppRole).where(AppRole.id == role_id, AppRole.application_id == app_id)
        )
        return result.scalar_one_or_none()

    async def count_role_assignments(self, role_id: str) -> int:
        result = await self.db.execute(
            select(func.count(AppAssignment.id))
            .where(AppAssignment.app_role_id == role_id)
            .where(AppAssignment.status == "active")
        )
        return result.scalar()

    # ── Assignments ──
    async def get_assignment_by_id(self, assignment_id: str) -> AppAssignment | None:
        result = await self.db.execute(
            select(AppAssignment)
            .options(*_assignment_options())
            .where(AppAssignment.id == assignment_id)
        )
        return result.scalar_one_or_none()

    async def get_user_assignments(
        self, user_id: str, include_revoked: bool = False
    ) -> list[AppAssignment]:
        """Active assignments, or the full history (revoked and expired too) on request."""
        query = (
            select(AppAssignment)
            .options(*_assignment_options())
            .where(AppAssignment.user_id == user_id)
            .order_by(AppAssignment.assigned_at.desc())
        )
        if not include_revoked:
            query = query.where(AppAssignment.status == "active")
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_effective_user_assignments(self, user_id: str) -> list[AppAssignment]:
        result = await self.db.execute(
            select(AppAssignment)
            .options(*_assignment_options())
            .where(AppAssignment.user_id == user_id)
            .where(effective_filter())
            .order_by(AppAssignment.assigned_at.desc())
        )
        return list(result.scalars().all())

    async def total_assignments(self) -> int:
        result = await self.db.execute(
            select(func.count(AppAssignment.id)).where(effective_filter())
        )
        return result.scalar()
