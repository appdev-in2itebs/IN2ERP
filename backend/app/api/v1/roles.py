"""
In2IT ERP - Roles & Permissions API Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user, require_permission
from app.db.database import get_db
from app.models.role import Role
from app.models.user import User
from app.repositories.role_repository import RoleRepository
from app.schemas.role import (
    AssignRoleRequest, PermissionOverrideRequest, PermissionResponse,
    RoleCreate, RoleResponse, RoleUpdate, RoleWithPermissions,
)

router = APIRouter(prefix="/roles", tags=["Roles & Permissions"])


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
    existing = await repo.get_role_by_name(data.name)
    if existing:
        raise HTTPException(status_code=409, detail="Role name already exists")

    role = Role(name=data.name, description=data.description, color=data.color)
    await repo.create_role(role)

    if data.permission_ids:
        await repo.set_role_permissions(role.id, data.permission_ids)

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

    update_data = data.model_dump(exclude_unset=True, exclude={"permission_ids"})
    await repo.update_role(role, update_data)

    if data.permission_ids is not None:
        await repo.set_role_permissions(role.id, data.permission_ids)

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
    await repo.delete_role(role)


# ── Permissions ──

@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    module: str | None = None,
    current_user: User = Depends(require_permission("roles.read")),
    db: AsyncSession = Depends(get_db),
):
    """List all available permissions."""
    repo = RoleRepository(db)
    perms = await repo.list_permissions(module=module)
    return [PermissionResponse.model_validate(p) for p in perms]


# ── Role Assignment ──

@router.post("/assign", status_code=201)
async def assign_role(
    data: AssignRoleRequest,
    current_user: User = Depends(require_permission("roles.assign")),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a user."""
    repo = RoleRepository(db)
    await repo.assign_role_to_user(data.user_id, data.role_id, assigned_by=current_user.id)
    return {"message": "Role assigned successfully"}


@router.delete("/assign/{user_id}/{role_id}", status_code=204)
async def unassign_role(
    user_id: str, role_id: str,
    current_user: User = Depends(require_permission("roles.assign")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a role from a user."""
    repo = RoleRepository(db)
    await repo.remove_role_from_user(user_id, role_id)


# ── Permission Overrides ──

@router.post("/overrides", status_code=201)
async def set_permission_override(
    data: PermissionOverrideRequest,
    current_user: User = Depends(require_permission("roles.override")),
    db: AsyncSession = Depends(get_db),
):
    """Set a per-user permission override (grant or deny)."""
    repo = RoleRepository(db)
    await repo.set_permission_override(
        data.user_id, data.permission_id, data.is_granted,
        reason=data.reason, granted_by=current_user.id
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
    await repo.remove_permission_override(user_id, permission_id)
