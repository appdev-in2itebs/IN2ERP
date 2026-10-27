"""
In2IT ERP - Assignments API Routes
Manage application-to-user assignments.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user, require_permission
from app.db.database import get_db
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.application import (
    AssignmentCreate, AssignmentResponse, AssignmentUpdate,
    UserAssignmentSyncRequest,
)
from app.schemas.user import UserResponse
from app.services.assignment_service import AssignmentService

router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.get("/user/{user_id}", response_model=list[AssignmentResponse])
async def get_user_assignments(
    user_id: str,
    current_user: User = Depends(require_permission("assignments.read")),
    db: AsyncSession = Depends(get_db),
):
    """Get all application assignments for a user."""
    repo = ApplicationRepository(db)
    assignments = await repo.get_user_assignments(user_id)
    return [
        AssignmentResponse(
            id=a.id, user_id=a.user_id, application_id=a.application_id,
            app_role=a.app_role or "Member",
            status=a.status, assigned_at=a.assigned_at,
            assigned_by=a.assigned_by, expires_at=a.expires_at,
            notes=a.notes,
            application_name=a.application.name if a.application else None,
        )
        for a in assignments
    ]


@router.post("", response_model=AssignmentResponse, status_code=201)
async def create_assignment(
    data: AssignmentCreate,
    current_user: User = Depends(require_permission("assignments.create")),
    db: AsyncSession = Depends(get_db),
):
    """Assign an application to a user."""
    service = AssignmentService(db)
    return await service.create_assignment(data, assigned_by=current_user.id)


@router.patch("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: str, data: AssignmentUpdate,
    current_user: User = Depends(require_permission("assignments.update")),
    db: AsyncSession = Depends(get_db),
):
    """Update an assignment (status, notes, expiry)."""
    service = AssignmentService(db)
    return await service.update_assignment(assignment_id, data, updated_by=current_user.id)


@router.delete("/{assignment_id}", status_code=204)
async def delete_assignment(
    assignment_id: str,
    current_user: User = Depends(require_permission("assignments.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Remove an application assignment."""
    service = AssignmentService(db)
    await service.delete_assignment(assignment_id, deleted_by=current_user.id)


@router.put("/user/{user_id}/sync", response_model=UserResponse)
async def sync_user_assignments(
    user_id: str,
    data: UserAssignmentSyncRequest,
    current_user: User = Depends(require_permission("assignments.update")),
    db: AsyncSession = Depends(get_db),
):
    """Sync all application assignments and metadata for a user (Odoo ERP Access Rights)."""
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    update_data = {}
    if data.department is not None:
        update_data["department"] = data.department
    if data.designation is not None:
        update_data["designation"] = data.designation
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.is_active is not None:
        update_data["is_active"] = data.is_active

    if update_data:
        await user_repo.update(user, update_data)

    service = AssignmentService(db)
    assignments_dicts = [a.model_dump() for a in data.assignments]
    await service.sync_user_assignments(user_id, assignments_dicts, assigned_by=current_user.id)

    updated_user = await user_repo.get_by_id(user_id)
    return UserResponse.model_validate(updated_user)
