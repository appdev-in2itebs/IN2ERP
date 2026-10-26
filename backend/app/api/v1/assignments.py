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
from app.schemas.application import (
    AssignmentCreate, AssignmentResponse, AssignmentUpdate,
)
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
