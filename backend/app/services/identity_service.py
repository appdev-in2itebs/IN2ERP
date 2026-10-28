"""
In2IT ERP - Identity Service
Maps a validated Microsoft Entra identity onto an employee record.

Rules:
- Employees are matched on tenant ID + object ID.
- An unlinked employee may be linked on first sign-in by email (ENTRA_LINK_BY_EMAIL),
  only if that employee has no Entra link yet. A conflicting link is refused.
- Unknown identities are refused unless ENTRA_AUTO_PROVISION is enabled; auto-provisioned
  employees receive only the baseline Employee role. Signing in never grants admin rights.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.entra import EntraIdentity
from app.models.role import Role, UserRole
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.audit_service import commit_audit, record_audit

NOT_REGISTERED = (
    "Your Microsoft account is not registered in In2ERP. Ask your ERP administrator for access."
)


async def resolve_entra_user(db: AsyncSession, identity: EntraIdentity) -> User:
    settings = get_settings()
    repo = UserRepository(db)

    result = await db.execute(select(User.id).where(User.entra_id == identity.object_id))
    user_id = result.scalar_one_or_none()
    if user_id:
        user = await repo.get_by_id(user_id)
        if user.entra_tenant_id and user.entra_tenant_id != identity.tenant_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=NOT_REGISTERED)
        return user

    if settings.ENTRA_LINK_BY_EMAIL and identity.email:
        result = await db.execute(
            select(User.id).where(func.lower(User.email) == identity.email)
        )
        candidate_id = result.scalar_one_or_none()
        if candidate_id:
            user = await repo.get_by_id(candidate_id)
            if user.entra_id:
                await commit_audit(
                    db, action="entra_link_conflict", resource_type="user", resource_id=user.id,
                    status="failure", actor_email=identity.email,
                    details={"tenant_id": identity.tenant_id, "object_id": identity.object_id},
                )
                raise HTTPException(status.HTTP_403_FORBIDDEN, detail=NOT_REGISTERED)
            user.entra_id = identity.object_id
            user.entra_tenant_id = identity.tenant_id
            await record_audit(
                db, action="entra_link", resource_type="user", resource_id=user.id, actor=user,
                details={"tenant_id": identity.tenant_id, "object_id": identity.object_id},
            )
            return user

    if settings.ENTRA_AUTO_PROVISION and identity.email:
        user = User(
            email=identity.email,
            first_name=identity.given_name or (identity.name or identity.email).split(" ")[0],
            last_name=identity.family_name or "",
            entra_id=identity.object_id,
            entra_tenant_id=identity.tenant_id,
            is_active=True,
        )
        await repo.create(user)
        employee_role = (
            await db.execute(select(Role).where(Role.name == "Employee"))
        ).scalar_one_or_none()
        if employee_role:
            db.add(UserRole(user_id=user.id, role_id=employee_role.id))
        await record_audit(
            db, action="entra_auto_provision", resource_type="user", resource_id=user.id,
            actor=user, details={"tenant_id": identity.tenant_id},
        )
        await db.flush()
        return await repo.get_by_id(user.id)

    await commit_audit(
        db, action="login_failed", resource_type="auth", status="failure",
        actor_email=identity.email,
        details={"reason": "entra_identity_not_registered", "tenant_id": identity.tenant_id,
                 "object_id": identity.object_id},
    )
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=NOT_REGISTERED)


async def touch_last_login(user: User) -> None:
    now = datetime.now(timezone.utc)
    last = user.last_login_at
    if last and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if not last or (now - last).total_seconds() > 3600:
        user.last_login_at = now
