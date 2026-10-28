"""
In2IT ERP - Roles & Permissions API Routes
ERP roles govern ERP administration only. Application roles live in the
application role catalogue (see applications.py).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import require_permission
from app.db.database import get_db
from app.models.role import Role
from app.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.role import (
    AssignRoleRequest, PermissionOverrideRequest, PermissionResponse,
    RoleCreate, RoleResponse, RoleUpdate, RoleWithPermissions,
)
from app.services.audit_service import record_audit
from app.services.authorization_service import AuthorizationService, ensure_can_manage_user

router = APIRouter(prefix="/roles", tags=["Roles & Permissions"])


async def _permission_codes(repo: RoleRepository, permission_ids: list[str]) -> list[str]:
    codes = []
    for pid in permission_ids:
        perm = await repo.get_permission_by_id(pid)
        if not perm:
            raise HTTPException(status_code=400, detail=f"Unknown permission id: {pid}")
        codes.append(perm.code)
    return codes


async def _get_user_or_404(db: AsyncSession, user_id: str) -> User:
    user = await UserRepository(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("", response_model=list[RoleWithPermissions])
async def list_roles(
    current_user: User = Depends(require_permission("roles.read")),
    db: AsyncSession = Depends(get_db),
):
    """List all roles with their permissions."""
    repo = RoleRepository(db)
    roles = await repo.list_roles()
    result = []
    for role in roles:
        user_count = await repo.get_role_user_count(role.id)
        permissions = [
            PermissionResponse.model_validate(rp.permission)
            for rp in role.permissions
        ]
        result.append(RoleWithPermissions(
            id=role.id, name=role.name, description=role.description,
            is_system=role.is_system, color=role.color,
            created_at=role.created_at, updated_at=role.updated_at,
            permissions=permissions, user_count=user_count,
        ))
    return result


@router.post("", response_model=RoleResponse, status_code=201)
async def create_role(
    data: RoleCreate,
    current_user: User = Depends(require_permission("roles.create")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new role."""
    repo = RoleRepository(db)
    if await repo.get_role_by_name(data.name):
        raise HTTPException(status_code=409, detail="Role name already exists")

    codes = await _permission_codes(repo, data.permission_ids)
    await AuthorizationService(db).ensure_can_grant(current_user, codes)

    role = Role(name=data.name, description=data.description, color=data.color)
    await repo.create_role(role)
    if data.permission_ids:
        await repo.set_role_permissions(role.id, data.permission_ids)

    await record_audit(
        db, action="create_role", resource_type="role", resource_id=role.id,
        actor=current_user, details={"name": role.name, "permissions": codes},
    )
    return RoleResponse.model_validate(role)


@router.patch("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str, data: RoleUpdate,
    current_user: User = Depends(require_permission("roles.update")),
    db: AsyncSession = Depends(get_db),
):
    """Update a role."""
    repo = RoleRepository(db)
    role = await repo.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be modified")

    details: dict = {"name": role.name}
    if data.permission_ids is not None:
        codes = await _permission_codes(repo, data.permission_ids)
        await AuthorizationService(db).ensure_can_grant(current_user, codes)
        details["permissions_before"] = sorted(rp.permission.code for rp in role.permissions)
        details["permissions_after"] = sorted(codes)

    update_data = data.model_dump(exclude_unset=True, exclude={"permission_ids"})
    await repo.update_role(role, update_data)
    if data.permission_ids is not None:
        await repo.set_role_permissions(role.id, data.permission_ids)

    details["changes"] = update_data
    await record_audit(
        db, action="update_role", resource_type="role", resource_id=role.id,
        actor=current_user, details=details,
    )
    return RoleResponse.model_validate(role)


@router.delete("/{role_id}", status_code=204)
async def delete_role(
    role_id: str,
    current_user: User = Depends(require_permission("roles.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a role."""
    repo = RoleRepository(db)
    role = await repo.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")

    await record_audit(
        db, action="delete_role", resource_type="role", resource_id=role.id,
        actor=current_user, details={"name": role.name},
    )
    await repo.delete_role(role)


# ── Permissions ──

@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    module: str | None = None,
    current_user: User = Depends(require_permission("roles.read")),
    db: AsyncSession = Depends(get_db),
):
    """List all available permissions."""
    perms = await RoleRepository(db).list_permissions(module=module)
    return [PermissionResponse.model_validate(p) for p in perms]


# ── Role Assignment ──

@router.post("/assign", status_code=201)
async def assign_role(
    data: AssignRoleRequest,
    current_user: User = Depends(require_permission("roles.assign")),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a user. You cannot assign roles that exceed your own permissions."""
    repo = RoleRepository(db)
    target = await _get_user_or_404(db, data.user_id)
    ensure_can_manage_user(current_user, target)

    role = await repo.get_role_by_id(data.role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await AuthorizationService(db).ensure_can_grant(
        current_user, [rp.permission.code for rp in role.permissions]
    )
    if any(ur.role_id == role.id for ur in target.role_assignments):
        raise HTTPException(status_code=409, detail="User already has this role")

    await repo.assign_role_to_user(target.id, role.id, assigned_by=current_user.id)
    await record_audit(
        db, action="assign_role", resource_type="user_role", resource_id=target.id,
        actor=current_user, details={"user_email": target.email, "role": role.name},
    )
    return {"message": "Role assigned successfully"}


@router.delete("/assign/{user_id}/{role_id}", status_code=204)
async def unassign_role(
    user_id: str, role_id: str,
    current_user: User = Depends(require_permission("roles.assign")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a role from a user."""
    repo = RoleRepository(db)
    target = await _get_user_or_404(db, user_id)
    ensure_can_manage_user(current_user, target)

    role = await repo.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    # Removing a role is also a privilege decision: only roles within your own scope.
    await AuthorizationService(db).ensure_can_grant(
        current_user, [rp.permission.code for rp in role.permissions]
    )

    await repo.remove_role_from_user(user_id, role_id)
    await record_audit(
        db, action="unassign_role", resource_type="user_role", resource_id=target.id,
        actor=current_user, details={"user_email": target.email, "role": role.name},
    )


# ── Permission Overrides ──

@router.post("/overrides", status_code=201)
async def set_permission_override(
    data: PermissionOverrideRequest,
    current_user: User = Depends(require_permission("roles.override")),
    db: AsyncSession = Depends(get_db),
):
    """Set a per-user permission override (grant or deny)."""
    repo = RoleRepository(db)
    target = await _get_user_or_404(db, data.user_id)
    ensure_can_manage_user(current_user, target)

    perm = await repo.get_permission_by_id(data.permission_id)
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    await AuthorizationService(db).ensure_can_grant(current_user, [perm.code])

    await repo.set_permission_override(
        data.user_id, data.permission_id, data.is_granted,
        reason=data.reason, granted_by=current_user.id
    )
    await record_audit(
        db, action="set_permission_override", resource_type="user_permission",
        resource_id=target.id, actor=current_user,
        details={
            "user_email": target.email, "permission": perm.code,
            "is_granted": data.is_granted, "reason": data.reason,
        },
    )
    return {"message": "Permission override applied"}


@router.delete("/overrides/{user_id}/{permission_id}", status_code=204)
async def remove_permission_override(
    user_id: str, permission_id: str,
    current_user: User = Depends(require_permission("roles.override")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a per-user permission override."""
    repo = RoleRepository(db)
    target = await _get_user_or_404(db, user_id)
    ensure_can_manage_user(current_user, target)

    perm = await repo.get_permission_by_id(permission_id)
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    await AuthorizationService(db).ensure_can_grant(current_user, [perm.code])

    await repo.remove_permission_override(user_id, permission_id)
    await record_audit(
        db, action="remove_permission_override", resource_type="user_permission",
        resource_id=target.id, actor=current_user,
        details={"user_email": target.email, "permission": perm.code},
    )
