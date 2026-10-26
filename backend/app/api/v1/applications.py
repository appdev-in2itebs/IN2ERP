"""
In2IT ERP - Applications API Routes
CRUD for internal ERP modules/applications.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user, require_permission
from app.db.database import get_db
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.models.application import Application
from app.schemas.application import (
    ApplicationCreate, ApplicationResponse, ApplicationUpdate,
)

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=list[ApplicationResponse])
async def list_applications(
    category: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all applications/modules."""
    repo = ApplicationRepository(db)
    apps = await repo.list_applications(category=category, is_active=is_active)
    result = []
    for app in apps:
        count = await repo.get_assigned_user_count(app.id)
        resp = ApplicationResponse.model_validate(app)
        resp.assigned_users = count
        result.append(resp)
    return result


@router.get("/my", response_model=list[ApplicationResponse])
async def get_my_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List applications assigned to the current logged-in user (Odoo style)."""
    repo = ApplicationRepository(db)
    if current_user.is_superadmin:
        apps = await repo.list_applications(is_active=True)
        result = []
        for app in apps:
            count = await repo.get_assigned_user_count(app.id)
            resp = ApplicationResponse.model_validate(app)
            resp.assigned_users = count
            resp.user_app_role = "System Administrator"
            result.append(resp)
        return result

    assignments = await repo.get_user_assignments(current_user.id)
    result = []
    for a in assignments:
        if a.status == "active" and a.application and a.application.is_active:
            count = await repo.get_assigned_user_count(a.application.id)
            resp = ApplicationResponse.model_validate(a.application)
            resp.assigned_users = count
            resp.user_app_role = a.app_role or "Member"
            result.append(resp)
    return result


@router.get("/{app_id}", response_model=ApplicationResponse)
async def get_application(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get an application by ID."""
    repo = ApplicationRepository(db)
    app = await repo.get_by_id(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    count = await repo.get_assigned_user_count(app.id)
    resp = ApplicationResponse.model_validate(app)
    resp.assigned_users = count
    return resp


@router.post("", response_model=ApplicationResponse, status_code=201)
async def create_application(
    data: ApplicationCreate,
    current_user: User = Depends(require_permission("applications.create")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new application/module."""
    repo = ApplicationRepository(db)
    existing = await repo.get_by_slug(data.slug)
    if existing:
        raise HTTPException(status_code=409, detail="Application slug already exists")

    app = Application(**data.model_dump())
    await repo.create(app)
    resp = ApplicationResponse.model_validate(app)
    resp.assigned_users = 0
    return resp


@router.patch("/{app_id}", response_model=ApplicationResponse)
async def update_application(
    app_id: str, data: ApplicationUpdate,
    current_user: User = Depends(require_permission("applications.update")),
    db: AsyncSession = Depends(get_db),
):
    """Update an application."""
    repo = ApplicationRepository(db)
    app = await repo.get_by_id(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    update_data = data.model_dump(exclude_unset=True)
    await repo.update(app, update_data)
    count = await repo.get_assigned_user_count(app.id)
    resp = ApplicationResponse.model_validate(app)
    resp.assigned_users = count
    return resp


@router.delete("/{app_id}", status_code=204)
async def delete_application(
    app_id: str,
    current_user: User = Depends(require_permission("applications.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Delete an application."""
    repo = ApplicationRepository(db)
    app = await repo.get_by_id(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.is_core:
        raise HTTPException(status_code=400, detail="Core applications cannot be deleted")
    await repo.delete(app)
