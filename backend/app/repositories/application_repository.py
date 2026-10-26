"""
In2IT ERP - Application Repository
Data access layer for Application and AppAssignment models.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import AppAssignment, Application
from app.models.user import User


class ApplicationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Applications ──
    async def get_by_id(self, app_id: str) -> Application | None:
        result = await self.db.execute(
            select(Application).where(Application.id == app_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Application | None:
        result = await self.db.execute(
            select(Application).where(Application.slug == slug)
        )
        return result.scalar_one_or_none()

    async def list_applications(
        self, category: str | None = None, is_active: bool | None = None
    ) -> list[Application]:
        query = select(Application)
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
        result = await self.db.execute(
            select(func.count(AppAssignment.id))
            .where(AppAssignment.application_id == app_id)
            .where(AppAssignment.status == "active")
        )
        return result.scalar()

    # ── Assignments ──
    async def get_assignment_by_id(self, assignment_id: str) -> AppAssignment | None:
        result = await self.db.execute(
            select(AppAssignment)
            .options(
                selectinload(AppAssignment.user),
                selectinload(AppAssignment.application),
            )
            .where(AppAssignment.id == assignment_id)
        )
        return result.scalar_one_or_none()

    async def get_user_assignments(self, user_id: str) -> list[AppAssignment]:
        result = await self.db.execute(
            select(AppAssignment)
            .options(selectinload(AppAssignment.application))
            .where(AppAssignment.user_id == user_id)
            .order_by(AppAssignment.assigned_at.desc())
        )
        return list(result.scalars().all())

    async def get_app_assignments(
        self, app_id: str, page: int = 1, per_page: int = 20
    ) -> tuple[list[AppAssignment], int]:
        count_result = await self.db.execute(
            select(func.count(AppAssignment.id))
            .where(AppAssignment.application_id == app_id)
        )
        total = count_result.scalar()

        result = await self.db.execute(
            select(AppAssignment)
            .options(selectinload(AppAssignment.user))
            .where(AppAssignment.application_id == app_id)
            .order_by(AppAssignment.assigned_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        assignments = list(result.scalars().all())
        return assignments, total

    async def create_assignment(self, assignment: AppAssignment) -> AppAssignment:
        self.db.add(assignment)
        await self.db.flush()
        return assignment

    async def update_assignment(self, assignment: AppAssignment, data: dict) -> AppAssignment:
        for key, value in data.items():
            if value is not None:
                setattr(assignment, key, value)
        await self.db.flush()
        return assignment

    async def delete_assignment(self, assignment: AppAssignment) -> None:
        await self.db.delete(assignment)
        await self.db.flush()

    async def total_assignments(self) -> int:
        result = await self.db.execute(
            select(func.count(AppAssignment.id))
            .where(AppAssignment.status == "active")
        )
        return result.scalar()
