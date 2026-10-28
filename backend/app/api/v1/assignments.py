"""
In2IT ERP - Access & Provisioning API Routes
Grant and revoke employees' application roles and follow their provisioning status.

Only ERP administrators (assignments.* permissions, admin-capable session) can change
access. Changes are explicit: an omitted role is never revoked implicitly.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import Principal, effective_permissions, get_principal, require_permission
from app.db.database import get_db, get_session_factory
from app.models.provisioning import ProvisioningJob
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.schemas.application import (
    AccessChangeRequest, AccessChangeResponse, AssignmentCreate, AssignmentResponse,
    AssignmentUpdate, ManualConfirmRequest, PlannedChangeResponse, ProvisioningJobResponse,
)
from app.services.assignment_service import AccessService, to_response
from app.services.audit_service import commit_audit
from app.services.authorization_service import ensure_can_manage_user
from app.services.provisioning_service import expire_assignments, process_due_jobs

router = APIRouter(prefix="/assignments", tags=["Access"])
provisioning_router = APIRouter(prefix="/provisioning", tags=["Provisioning"])


async def _get_assignment(db: AsyncSession, assignment_id: str):
    assignment = await ApplicationRepository(db).get_assignment_by_id(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


async def _require(db: AsyncSession, principal: Principal, codes: set[str]) -> None:
    missing = codes - await effective_permissions(db, principal)
    if missing:
        await commit_audit(
            db, action="permission_denied", resource_type="authorization",
            actor=principal.user, status="failure",
            details={"permissions": sorted(missing), "path": "assignments/changes"},
        )
        raise HTTPException(status_code=403, detail=f"Permission required: {', '.join(sorted(missing))}")


@router.get("/user/{user_id}", response_model=list[AssignmentResponse])
async def get_user_assignments(
    user_id: str,
    include_history: bool = Query(False, description="Include revoked and expired roles"),
    current_user: User = Depends(require_permission("assignments.read")),
    db: AsyncSession = Depends(get_db),
):
    """An employee's application roles with provisioning status."""
    assignments = await ApplicationRepository(db).get_user_assignments(
        user_id, include_revoked=include_history
    )
    return [to_response(a) for a in assignments]


@router.post("/user/{user_id}/changes", response_model=AccessChangeResponse)
async def change_user_access(
    user_id: str,
    data: AccessChangeRequest,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    """
    Grant and/or revoke specific application roles for one employee.
    With `dry_run: true` the request is fully validated and the planned changes are
    returned for review without changing anything.
    """
    needed = {"assignments.read"}
    if data.grants:
        needed.add("assignments.create")
    if data.revokes:
        needed.add("assignments.delete")
    await _require(db, principal, needed)

    service = AccessService(db)
    plan = await service.plan(
        principal.user, user_id, [g.model_dump() for g in data.grants], data.revokes
    )
    changes = [PlannedChangeResponse(**c.as_dict()) for c in plan.changes]
    if data.dry_run:
        return AccessChangeResponse(dry_run=True, changes=changes)

    touched = await service.apply(plan, principal.user)
    return AccessChangeResponse(
        dry_run=False, changes=changes, assignments=[to_response(a) for a in touched]
    )


@router.post("", response_model=AssignmentResponse, status_code=201)
async def create_assignment(
    data: AssignmentCreate,
    current_user: User = Depends(require_permission("assignments.create")),
    db: AsyncSession = Depends(get_db),
):
    """Grant one application role to an employee."""
    assignment = await AccessService(db).grant_one(
        current_user, data.user_id, data.application_id, data.app_role_id,
        expires_at=data.expires_at, notes=data.notes,
    )
    return to_response(assignment)


@router.patch("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: str, data: AssignmentUpdate,
    current_user: User = Depends(require_permission("assignments.update")),
    db: AsyncSession = Depends(get_db),
):
    """Change an assignment's notes or expiry."""
    assignment = await _get_assignment(db, assignment_id)
    updated = await AccessService(db).update_details(
        assignment, current_user, data.model_dump(exclude_unset=True)
    )
    return to_response(updated)


@router.delete("/{assignment_id}", response_model=AssignmentResponse)
async def revoke_assignment(
    assignment_id: str,
    current_user: User = Depends(require_permission("assignments.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an application role. The response shows the pending revocation status."""
    assignment = await _get_assignment(db, assignment_id)
    ensure_can_manage_user(current_user, assignment.user)
    return to_response(await AccessService(db).revoke(assignment, current_user, reason="admin"))


@router.post("/{assignment_id}/retry", response_model=AssignmentResponse)
async def retry_assignment(
    assignment_id: str,
    current_user: User = Depends(require_permission("assignments.update")),
    db: AsyncSession = Depends(get_db),
):
    """Queue another provisioning attempt for a failed or unreconciled change."""
    assignment = await _get_assignment(db, assignment_id)
    return to_response(await AccessService(db).retry(assignment, current_user))


@router.post("/{assignment_id}/confirm", response_model=AssignmentResponse)
async def confirm_assignment(
    assignment_id: str, data: ManualConfirmRequest,
    current_user: User = Depends(require_permission("assignments.update")),
    db: AsyncSession = Depends(get_db),
):
    """For manually managed applications: confirm the change was applied in the target app."""
    assignment = await _get_assignment(db, assignment_id)
    return to_response(await AccessService(db).confirm_manual(assignment, current_user, data.note))


# ── Provisioning queue ──

@provisioning_router.get("/jobs", response_model=list[ProvisioningJobResponse])
async def list_jobs(
    status: str | None = None,
    assignment_id: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_permission("assignments.read")),
    db: AsyncSession = Depends(get_db),
):
    """Recent provisioning jobs, newest first."""
    query = select(ProvisioningJob).order_by(ProvisioningJob.created_at.desc()).limit(limit)
    if status:
        query = query.where(ProvisioningJob.status == status)
    if assignment_id:
        query = query.where(ProvisioningJob.assignment_id == assignment_id)
    jobs = (await db.execute(query)).scalars().all()
    return [ProvisioningJobResponse.model_validate(j) for j in jobs]


@provisioning_router.post("/run")
async def run_provisioning_now(
    current_user: User = Depends(require_permission("assignments.update")),
    session_factory=Depends(get_session_factory),
):
    """Run the expiry sweep and deliver due jobs immediately (normally done by the worker)."""
    expired = await expire_assignments(session_factory)
    results = await process_due_jobs(session_factory)
    return {"expired": expired, "jobs": results}
