"""
In2IT ERP - Authorization Service
Resolves effective permissions for a user (role-based + overrides) and enforces
the guard rails that prevent privilege escalation.
"""

from collections.abc import Iterable

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.role_repository import RoleRepository


class AuthorizationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.role_repo = RoleRepository(db)

    async def get_user_permissions(self, user_id: str) -> set[str]:
        """
        Resolve the effective permission set for a user.
        1. Collect all permissions from assigned roles.
        2. Apply per-user overrides (grant or deny).
        """
        # Step 1: Collect role-based permissions
        roles = await self.role_repo.get_user_roles(user_id)
        permissions: set[str] = set()
        for role in roles:
            for rp in role.permissions:
                permissions.add(rp.permission.code)

        # Step 2: Apply user-level overrides
        overrides = await self.role_repo.get_user_permission_overrides(user_id)
        for override in overrides:
            if override.is_granted:
                permissions.add(override.permission.code)
            else:
                permissions.discard(override.permission.code)

        return permissions

    async def has_permission(self, user_id: str, permission_code: str) -> bool:
        """Check if a user has a specific permission."""
        permissions = await self.get_user_permissions(user_id)
        return permission_code in permissions

    async def has_any_permission(self, user_id: str, permission_codes: list[str]) -> bool:
        """Check if a user has any of the specified permissions."""
        permissions = await self.get_user_permissions(user_id)
        return bool(permissions & set(permission_codes))

    async def has_all_permissions(self, user_id: str, permission_codes: list[str]) -> bool:
        """Check if a user has all of the specified permissions."""
        permissions = await self.get_user_permissions(user_id)
        return set(permission_codes).issubset(permissions)

    # ── Escalation guards ──

    async def ensure_can_grant(self, actor: User, permission_codes: Iterable[str]) -> None:
        """
        A non-superadmin may only hand out permissions they hold themselves.
        This blocks e.g. an Admin assigning the Super Admin role to anyone.
        """
        if actor.is_superadmin:
            return
        held = await self.get_user_permissions(actor.id)
        missing = sorted(set(permission_codes) - held)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You cannot grant permissions you do not hold: {', '.join(missing)}",
            )


def ensure_can_manage_user(actor: User, target: User, *, allow_self: bool = False) -> None:
    """
    Guard administrative actions on another account.
    - Only a superadmin may act on a superadmin account.
    - Self-administration is refused unless explicitly allowed, so an administrator
      cannot raise their own privileges, reset their own password or disable themselves.
    """
    if target.id == actor.id and not allow_self:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot perform this administrative action on your own account",
        )
    if target.is_superadmin and not actor.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a superadmin can manage a superadmin account",
        )
