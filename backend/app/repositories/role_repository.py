"""
In2IT ERP - Role Repository
Data access layer for Role, Permission, and RBAC junction tables.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import (
    Permission, Role, RolePermission, UserPermissionOverride, UserRole,
)


class RoleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Roles ──
    async def get_role_by_id(self, role_id: str) -> Role | None:
        result = await self.db.execute(
            select(Role)
            .options(selectinload(Role.permissions).selectinload(RolePermission.permission))
            .where(Role.id == role_id)
        )
        return result.scalar_one_or_none()

    async def get_role_by_name(self, name: str) -> Role | None:
        result = await self.db.execute(select(Role).where(Role.name == name))
        return result.scalar_one_or_none()

    async def list_roles(self) -> list[Role]:
        result = await self.db.execute(
            select(Role)
            .options(selectinload(Role.permissions).selectinload(RolePermission.permission))
            .order_by(Role.name)
        )
        return list(result.scalars().all())

    async def create_role(self, role: Role) -> Role:
        self.db.add(role)
        await self.db.flush()
        return role

    async def update_role(self, role: Role, data: dict) -> Role:
        for key, value in data.items():
            if value is not None:
                setattr(role, key, value)
        await self.db.flush()
        return role

    async def delete_role(self, role: Role) -> None:
        await self.db.delete(role)
        await self.db.flush()

    async def get_role_user_count(self, role_id: str) -> int:
        result = await self.db.execute(
            select(func.count(UserRole.id)).where(UserRole.role_id == role_id)
        )
        return result.scalar()

    # ── Permissions ──
    async def get_permission_by_id(self, permission_id: str) -> Permission | None:
        result = await self.db.execute(
            select(Permission).where(Permission.id == permission_id)
        )
        return result.scalar_one_or_none()

    async def get_permission_by_code(self, code: str) -> Permission | None:
        result = await self.db.execute(
            select(Permission).where(Permission.code == code)
        )
        return result.scalar_one_or_none()

    async def list_permissions(self, module: str | None = None) -> list[Permission]:
        query = select(Permission)
        if module:
            query = query.where(Permission.module == module)
        query = query.order_by(Permission.module, Permission.code)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_permission(self, permission: Permission) -> Permission:
        self.db.add(permission)
        await self.db.flush()
        return permission

    # ── Role-Permission Mapping ──
    async def set_role_permissions(self, role_id: str, permission_ids: list[str]) -> None:
        # Remove existing
        existing = await self.db.execute(
            select(RolePermission).where(RolePermission.role_id == role_id)
        )
        for rp in existing.scalars().all():
            await self.db.delete(rp)

        # Add new
        for pid in permission_ids:
            self.db.add(RolePermission(role_id=role_id, permission_id=pid))
        await self.db.flush()

    # ── User-Role Mapping ──
    async def assign_role_to_user(
        self, user_id: str, role_id: str, assigned_by: str | None = None
    ) -> UserRole:
        ur = UserRole(user_id=user_id, role_id=role_id, assigned_by=assigned_by)
        self.db.add(ur)
        await self.db.flush()
        return ur

    async def remove_role_from_user(self, user_id: str, role_id: str) -> None:
        result = await self.db.execute(
            select(UserRole).where(
                (UserRole.user_id == user_id) & (UserRole.role_id == role_id)
            )
        )
        ur = result.scalar_one_or_none()
        if ur:
            await self.db.delete(ur)
            await self.db.flush()

    async def get_user_roles(self, user_id: str) -> list[Role]:
        result = await self.db.execute(
            select(Role)
            .join(UserRole)
            .where(UserRole.user_id == user_id)
            .options(selectinload(Role.permissions).selectinload(RolePermission.permission))
        )
        return list(result.scalars().all())

    # ── User Permission Overrides ──
    async def set_permission_override(
        self, user_id: str, permission_id: str, is_granted: bool,
        reason: str | None = None, granted_by: str | None = None
    ) -> UserPermissionOverride:
        # Check existing
        result = await self.db.execute(
            select(UserPermissionOverride).where(
                (UserPermissionOverride.user_id == user_id)
                & (UserPermissionOverride.permission_id == permission_id)
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.is_granted = is_granted
            existing.reason = reason
            existing.granted_by = granted_by
            await self.db.flush()
            return existing

        override = UserPermissionOverride(
            user_id=user_id, permission_id=permission_id,
            is_granted=is_granted, reason=reason, granted_by=granted_by
        )
        self.db.add(override)
        await self.db.flush()
        return override

    async def remove_permission_override(self, user_id: str, permission_id: str) -> None:
        result = await self.db.execute(
            select(UserPermissionOverride).where(
                (UserPermissionOverride.user_id == user_id)
                & (UserPermissionOverride.permission_id == permission_id)
            )
        )
        override = result.scalar_one_or_none()
        if override:
            await self.db.delete(override)
            await self.db.flush()

    async def get_user_permission_overrides(
        self, user_id: str
    ) -> list[UserPermissionOverride]:
        result = await self.db.execute(
            select(UserPermissionOverride)
            .options(selectinload(UserPermissionOverride.permission))
            .where(UserPermissionOverride.user_id == user_id)
        )
        return list(result.scalars().all())
