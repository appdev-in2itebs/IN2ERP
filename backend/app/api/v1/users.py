"""
In2IT ERP - Users API Routes
Employee account management (admin actions).
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import require_permission
from app.core.security import generate_temporary_password, hash_password
from app.db.database import get_db
from app.models.role import UserRole
from app.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    EntraLinkRequest, ResetPasswordRequest, UserCreate, UserListResponse, UserResponse,
    UserUpdate, UserWithTemporaryPassword,
)
from app.services.assignment_service import AccessService
from app.services.audit_service import record_audit
from app.services.auth_service import AuthService, ensure_password_policy
from app.services.authorization_service import ensure_can_manage_user

router = APIRouter(prefix="/users", tags=["Users"])


async def _get_user_or_404(repo: UserRepository, user_id: str) -> User:
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _issue_temporary_password(user: User, requested: str | None) -> str:
    """Set a one-time password that must be changed at next sign-in."""
    password = requested or generate_temporary_password()
    ensure_password_policy(password)
    user.hashed_password = hash_password(password)
    user.must_change_password = True
    user.password_changed_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0
    user.locked_until = None
    return password


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = None,
    department: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(require_permission("employees.read")),
    db: AsyncSession = Depends(get_db),
):
    """List users with pagination and filtering."""
    repo = UserRepository(db)
    users, total = await repo.list_users(
        page=page, per_page=per_page, search=search,
        department=department, is_active=is_active
    )
    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total, page=page, per_page=per_page,
    )


@router.get("/departments", response_model=list[str])
async def list_departments(
    current_user: User = Depends(require_permission("employees.read")),
    db: AsyncSession = Depends(get_db),
):
    """Get list of all departments."""
    return await UserRepository(db).get_departments()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_permission("employees.read")),
    db: AsyncSession = Depends(get_db),
):
    """Get a user by ID."""
    user = await _get_user_or_404(UserRepository(db), user_id)
    return UserResponse.model_validate(user)


@router.post("", response_model=UserWithTemporaryPassword, status_code=201)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(require_permission("employees.create")),
    db: AsyncSession = Depends(get_db),
):
    """
    Create an employee account. The response carries the one-time password exactly once;
    the employee must change it at first sign-in.
    """
    repo = UserRepository(db)
    if await repo.get_by_email(data.email):
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        department=data.department,
        designation=data.designation,
        avatar_url=data.avatar_url,
    )
    temporary_password = _issue_temporary_password(user, data.password)
    await repo.create(user)

    employee_role = await RoleRepository(db).get_role_by_name("Employee")
    if employee_role:
        db.add(UserRole(user_id=user.id, role_id=employee_role.id, assigned_by=current_user.id))
        await db.flush()

    await record_audit(
        db, action="create_user", resource_type="user", resource_id=user.id,
        actor=current_user, details={"email": user.email, "department": user.department},
    )
    user = await repo.get_by_id(user.id)
    return UserWithTemporaryPassword(
        **UserResponse.model_validate(user).model_dump(), temporary_password=temporary_password
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: User = Depends(require_permission("employees.update")),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's profile or activation state."""
    repo = UserRepository(db)
    user = await _get_user_or_404(repo, user_id)
    update_data = data.model_dump(exclude_unset=True, exclude_none=True)

    changes_activation = "is_active" in update_data
    ensure_can_manage_user(current_user, user, allow_self=not changes_activation)

    before = {k: getattr(user, k) for k in update_data}
    was_active = user.is_active
    await repo.update(user, update_data)

    await record_audit(
        db, action="update_user", resource_type="user", resource_id=user.id,
        actor=current_user, details={"before": before, "after": update_data},
    )
    if was_active and not user.is_active:
        # Deactivation ends ERP sessions now and starts removing application access.
        await AuthService(db).revoke_all_sessions(user)
        await AccessService(db).revoke_all_for_user(user, current_user, reason="deactivated")

    user = await repo.get_by_id(user.id)
    return UserResponse.model_validate(user)


@router.put("/{user_id}/entra-link", response_model=UserResponse)
async def link_entra_identity(
    user_id: str,
    data: EntraLinkRequest,
    current_user: User = Depends(require_permission("employees.update")),
    db: AsyncSession = Depends(get_db),
):
    """Link an employee to their Microsoft Entra account (tenant ID + object ID)."""
    repo = UserRepository(db)
    user = await _get_user_or_404(repo, user_id)
    ensure_can_manage_user(current_user, user)

    object_id, tenant_id = data.entra_object_id.lower(), data.entra_tenant_id.lower()
    existing = await db.execute(select(User.id).where(User.entra_id == object_id, User.id != user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="That Entra account is linked to another employee")

    before = {"entra_id": user.entra_id, "entra_tenant_id": user.entra_tenant_id}
    user.entra_id, user.entra_tenant_id = object_id, tenant_id
    await record_audit(
        db, action="entra_link", resource_type="user", resource_id=user.id, actor=current_user,
        details={"email": user.email, "before": before,
                 "after": {"entra_id": object_id, "entra_tenant_id": tenant_id}},
    )
    return UserResponse.model_validate(user)


@router.delete("/{user_id}/entra-link", response_model=UserResponse)
async def unlink_entra_identity(
    user_id: str,
    current_user: User = Depends(require_permission("employees.update")),
    db: AsyncSession = Depends(get_db),
):
    """Remove an employee's Entra link (their Entra sessions stop working)."""
    repo = UserRepository(db)
    user = await _get_user_or_404(repo, user_id)
    ensure_can_manage_user(current_user, user)

    before = {"entra_id": user.entra_id, "entra_tenant_id": user.entra_tenant_id}
    user.entra_id = user.entra_tenant_id = None
    await record_audit(
        db, action="entra_unlink", resource_type="user", resource_id=user.id,
        actor=current_user, details={"email": user.email, "before": before},
    )
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_permission("employees.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user. Prefer deactivation to keep history intact."""
    repo = UserRepository(db)
    user = await _get_user_or_404(repo, user_id)
    ensure_can_manage_user(current_user, user)

    await record_audit(
        db, action="delete_user", resource_type="user", resource_id=user.id,
        actor=current_user, details={"email": user.email},
    )
    await repo.delete(user)


@router.post("/{user_id}/reset-password", response_model=UserWithTemporaryPassword)
async def reset_user_password(
    user_id: str,
    data: ResetPasswordRequest,
    current_user: User = Depends(require_permission("employees.update")),
    db: AsyncSession = Depends(get_db),
):
    """
    Issue a one-time password (returned once), unlock the account and sign the user out
    everywhere. The user must choose a new password at next sign-in.
    """
    repo = UserRepository(db)
    user = await _get_user_or_404(repo, user_id)
    ensure_can_manage_user(current_user, user)

    temporary_password = _issue_temporary_password(user, data.password)
    user.revoke_sessions()
    await db.flush()

    await record_audit(
        db, action="reset_password", resource_type="user", resource_id=user.id,
        actor=current_user, details={"email": user.email, "generated": data.password is None},
    )
    return UserWithTemporaryPassword(
        **UserResponse.model_validate(user).model_dump(), temporary_password=temporary_password
    )


@router.post("/{user_id}/revoke-sessions", status_code=204)
async def revoke_user_sessions(
    user_id: str,
    current_user: User = Depends(require_permission("employees.update")),
    db: AsyncSession = Depends(get_db),
):
    """Sign a user out of every session immediately."""
    repo = UserRepository(db)
    user = await _get_user_or_404(repo, user_id)
    ensure_can_manage_user(current_user, user)

    user.revoke_sessions()
    await record_audit(
        db, action="revoke_sessions", resource_type="user", resource_id=user.id,
        actor=current_user, details={"email": user.email},
    )
