"""
In2IT ERP - User Repository
Data access layer for User model.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.role import UserRole, UserPermissionOverride


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .options(
                selectinload(User.role_assignments).selectinload(UserRole.role),
                selectinload(User.permission_overrides).selectinload(
                    UserPermissionOverride.permission
                ),
            )
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def list_users(
        self, page: int = 1, per_page: int = 20, search: str | None = None,
        department: str | None = None, is_active: bool | None = None
    ) -> tuple[list[User], int]:
        query = select(User)
        count_query = select(func.count(User.id))

        if search:
            search_filter = f"%{search}%"
            query = query.where(
                (User.email.ilike(search_filter))
                | (User.first_name.ilike(search_filter))
                | (User.last_name.ilike(search_filter))
            )
            count_query = count_query.where(
                (User.email.ilike(search_filter))
                | (User.first_name.ilike(search_filter))
                | (User.last_name.ilike(search_filter))
            )

        if department:
            query = query.where(User.department == department)
            count_query = count_query.where(User.department == department)

        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        query = query.order_by(User.created_at.desc())
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await self.db.execute(query)
        users = list(result.scalars().all())

        return users, total

    async def create(self, user: User) -> User:
        self.db.add(user)
        await self.db.flush()
        return user

    async def update(self, user: User, data: dict) -> User:
        for key, value in data.items():
            if value is not None:
                setattr(user, key, value)
        await self.db.flush()
        return user

    async def delete(self, user: User) -> None:
        await self.db.delete(user)
        await self.db.flush()

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(User.id)))
        return result.scalar()

    async def count_active(self) -> int:
        result = await self.db.execute(
            select(func.count(User.id)).where(User.is_active == True)
        )
        return result.scalar()

    async def get_departments(self) -> list[str]:
        result = await self.db.execute(
            select(User.department).where(User.department.isnot(None)).distinct()
        )
        return [row[0] for row in result.all()]
