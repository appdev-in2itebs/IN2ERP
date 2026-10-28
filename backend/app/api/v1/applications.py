"""
In2IT ERP - Applications API Routes
Application registry, connector configuration, each application's role catalogue,
and the caller's launchpad.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies import get_current_user, require_permission
from app.db.database import get_db
from app.integrations.base import ConnectorError, ManualActionRequired
from app.integrations.registry import build_connector, configuration_status, http_client
from app.models.application import AppAssignment, AppRole, Application
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.schemas.application import (
    AppRoleCreate, AppRoleResponse, AppRoleUpdate, ApplicationCreate, ApplicationResponse,
    ApplicationUpdate, ConnectionTestResult, ManualConfirmRequest, MyApplicationResponse,
    RoleSyncResult,
)
from app.services.assignment_service import AccessService, summarise_launchpad
from app.services.audit_service import record_audit

router = APIRouter(prefix="/applications", tags=["Applications"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _to_response(repo: ApplicationRepository, app: Application) -> ApplicationResponse:
    resp = ApplicationResponse.model_validate(app)
    resp.assigned_users = await repo.get_assigned_user_count(app.id)
    return resp


async def _get_app_or_404(repo: ApplicationRepository, app_id: str) -> Application:
    app = await repo.get_by_id(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


def _apply_connector_settings(app: Application, data: dict) -> None:
    if "connector_config" in data:
        config = data.pop("connector_config")
        app.connector_config = json.dumps(config) if config else None
    if "connector_secret_ref" in data:
        app.connector_secret_ref = data.pop("connector_secret_ref")


@router.get("", response_model=list[ApplicationResponse])
async def list_applications(
    category: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(require_permission("applications.read")),
    db: AsyncSession = Depends(get_db),
):
    """List registered applications with their role catalogues."""
    repo = ApplicationRepository(db)
    apps = await repo.list_applications(category=category, is_active=is_active)
    return [await _to_response(repo, app) for app in apps]


@router.get("/my", response_model=list[MyApplicationResponse])
async def get_my_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    The caller's launchpad: applications where they hold an active, unexpired role.
    Only applications whose access is verified in the target are launchable (`url` set);
    others are listed as pending or failed so the employee knows why.
    """
    assignments = await ApplicationRepository(db).get_effective_user_assignments(current_user.id)
    result = []
    for entry in summarise_launchpad(assignments):
        app = entry["app"]
        result.append(MyApplicationResponse(
            id=app.id, name=app.name, slug=app.slug, description=app.description,
            icon=app.icon, color=app.color, category=app.category,
            url=app.url if entry["access_state"] == "ready" else None,
            roles=entry["roles"], access_state=entry["access_state"],
            status_message=entry["status_message"],
        ))
    return result


@router.get("/{app_id}", response_model=ApplicationResponse)
async def get_application(
    app_id: str,
    current_user: User = Depends(require_permission("applications.read")),
    db: AsyncSession = Depends(get_db),
):
    """Get an application by ID."""
    repo = ApplicationRepository(db)
    return await _to_response(repo, await _get_app_or_404(repo, app_id))


@router.post("", response_model=ApplicationResponse, status_code=201)
async def create_application(
    data: ApplicationCreate,
    current_user: User = Depends(require_permission("applications.create")),
    db: AsyncSession = Depends(get_db),
):
    """Register an application, optionally with its role catalogue and connector settings."""
    repo = ApplicationRepository(db)
    if await repo.get_by_slug(data.slug):
        raise HTTPException(status_code=409, detail="Application slug already exists")
    if await repo.get_by_name(data.name):
        raise HTTPException(status_code=409, detail="Application name already exists")

    role_names = [r.name.lower() for r in data.roles]
    if len(role_names) != len(set(role_names)):
        raise HTTPException(status_code=400, detail="Role names must be unique")

    fields = data.model_dump(exclude={"roles"})
    app = Application()
    _apply_connector_settings(app, fields)
    for key, value in fields.items():
        setattr(app, key, value)
    app.roles = [AppRole(**r.model_dump()) for r in data.roles]
    app.integration_status = configuration_status(app)
    await repo.create(app)

    await record_audit(
        db, action="create_application", resource_type="application", resource_id=app.id,
        actor=current_user,
        details={"name": app.name, "slug": app.slug, "integration_type": app.integration_type,
                 "roles": [r.name for r in data.roles]},
    )
    return await _to_response(repo, app)


@router.patch("/{app_id}", response_model=ApplicationResponse)
async def update_application(
    app_id: str, data: ApplicationUpdate,
    current_user: User = Depends(require_permission("applications.update")),
    db: AsyncSession = Depends(get_db),
):
    """Update an application or its connector settings."""
    repo = ApplicationRepository(db)
    app = await _get_app_or_404(repo, app_id)

    changes = data.model_dump(exclude_unset=True)
    if changes.get("name") and changes["name"] != app.name and await repo.get_by_name(changes["name"]):
        raise HTTPException(status_code=409, detail="Application name already exists")

    before = {k: getattr(app, k) for k in changes}
    audit_changes = dict(changes)
    if "url" in changes and changes["url"] is None:
        app.url = None  # allow clearing the launch URL
    _apply_connector_settings(app, changes)
    await repo.update(app, changes)
    if {"integration_type", "connector_config", "connector_secret_ref"} & set(audit_changes):
        app.integration_status = configuration_status(app)
        app.last_connection_error = None

    await record_audit(
        db, action="update_application", resource_type="application", resource_id=app.id,
        actor=current_user, details={"name": app.name, "before": before, "after": audit_changes},
    )
    return await _to_response(repo, app)


@router.delete("/{app_id}", status_code=204)
async def delete_application(
    app_id: str,
    current_user: User = Depends(require_permission("applications.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Delete an application. Deactivate it instead to keep its access history."""
    repo = ApplicationRepository(db)
    app = await _get_app_or_404(repo, app_id)
    if app.is_core:
        raise HTTPException(status_code=400, detail="Core applications cannot be deleted")
    if await repo.get_assigned_user_count(app.id):
        raise HTTPException(
            status_code=409,
            detail="Employees still hold roles in this application. Revoke them or deactivate the application.",
        )

    await record_audit(
        db, action="delete_application", resource_type="application", resource_id=app.id,
        actor=current_user, details={"name": app.name, "slug": app.slug},
    )
    await repo.delete(app)


# ── Connector operations ──

@router.post("/{app_id}/test-connection", response_model=ConnectionTestResult)
async def test_connection(
    app_id: str,
    current_user: User = Depends(require_permission("applications.update")),
    db: AsyncSession = Depends(get_db),
):
    """Check that the connector can reach the target application with its credentials."""
    repo = ApplicationRepository(db)
    app = await _get_app_or_404(repo, app_id)
    app.last_connection_test_at = _utcnow()

    ok, message = False, ""
    try:
        async with http_client() as client:
            await build_connector(app, client).test_connection()
        ok, message = True, "Connection succeeded"
        app.integration_status, app.last_connection_error = "healthy", None
    except ManualActionRequired:
        message = "This application is managed manually; there is no connector to test"
        app.integration_status = "manual"
    except ConnectorError as exc:
        message = str(exc)
        app.integration_status = configuration_status(app)
        if app.integration_status == "configured":
            app.integration_status = "error"
        app.last_connection_error = message

    await record_audit(
        db, action="test_connection", resource_type="application", resource_id=app.id,
        actor=current_user, status="success" if ok else "failure",
        details={"application": app.name, "result": message},
    )
    return ConnectionTestResult(ok=ok, integration_status=app.integration_status, message=message)


@router.post("/{app_id}/roles/sync", response_model=RoleSyncResult)
async def sync_roles(
    app_id: str,
    current_user: User = Depends(require_permission("applications.update")),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve the application's roles from its connector and reconcile the catalogue:
    new roles are added, matched roles are marked verified, and catalogue roles the
    target no longer defines are marked missing (never deleted automatically).
    """
    repo = ApplicationRepository(db)
    app = await _get_app_or_404(repo, app_id)
    try:
        async with http_client() as client:
            external = await build_connector(app, client).list_roles()
    except ManualActionRequired:
        raise HTTPException(
            status_code=400, detail="Roles for manual applications are maintained by hand"
        ) from None
    except ConnectorError as exc:
        await record_audit(
            db, action="sync_app_roles", resource_type="application", resource_id=app.id,
            actor=current_user, status="failure", details={"application": app.name, "error": str(exc)},
        )
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Could not read roles: {exc}") from exc

    now = _utcnow()
    result = RoleSyncResult()
    by_external = {r.external_role_id: r for r in app.roles if r.external_role_id}
    by_name = {r.name.lower(): r for r in app.roles}
    seen: set[str] = set()

    for ext in external:
        role = by_external.get(ext.external_id) or by_name.get(ext.name.lower())
        if role:
            role.external_role_id = ext.external_id
            role.description = role.description or ext.description
            result.updated.append(role.name)
        else:
            role = AppRole(name=ext.name, description=ext.description, external_role_id=ext.external_id,
                           source="connector", sort_order=len(app.roles))
            app.roles.append(role)
            result.added.append(role.name)
        role.sync_status, role.synced_at = "verified", now
        seen.add(role.name.lower())

    for role in app.roles:
        if role.name.lower() not in seen:
            role.sync_status = "missing"
            result.missing.append(role.name)
    await db.flush()

    await record_audit(
        db, action="sync_app_roles", resource_type="application", resource_id=app.id,
        actor=current_user,
        details={"application": app.name, "added": result.added, "missing": result.missing},
    )
    result.roles = [AppRoleResponse.model_validate(r) for r in app.roles]
    return result


@router.post("/{app_id}/confirm-manual")
async def confirm_manual_changes(
    app_id: str, data: ManualConfirmRequest,
    current_user: User = Depends(require_permission("assignments.update")),
    db: AsyncSession = Depends(get_db),
):
    """Confirm every pending manual change for an application in one step (app owner attests)."""
    repo = ApplicationRepository(db)
    app = await _get_app_or_404(repo, app_id)
    if app.integration_type != "manual":
        raise HTTPException(status_code=400, detail="Only manually managed applications are confirmed")

    pending = (await db.execute(
        select(AppAssignment)
        .options(selectinload(AppAssignment.user), selectinload(AppAssignment.application))
        .where(AppAssignment.application_id == app.id,
               AppAssignment.provisioning_status == "manual_action_required")
    )).scalars().all()

    service = AccessService(db)
    confirmed = 0
    for assignment in pending:
        if assignment.user.is_superadmin and not current_user.is_superadmin:
            continue
        await service.confirm_manual(assignment, current_user, data.note)
        confirmed += 1
    return {"confirmed": confirmed}


# ── Application role catalogue ──

@router.get("/{app_id}/roles", response_model=list[AppRoleResponse])
async def list_app_roles(
    app_id: str,
    current_user: User = Depends(require_permission("applications.read")),
    db: AsyncSession = Depends(get_db),
):
    """List the roles an application defines."""
    app = await _get_app_or_404(ApplicationRepository(db), app_id)
    return [AppRoleResponse.model_validate(r) for r in app.roles]


@router.post("/{app_id}/roles", response_model=AppRoleResponse, status_code=201)
async def create_app_role(
    app_id: str, data: AppRoleCreate,
    current_user: User = Depends(require_permission("applications.update")),
    db: AsyncSession = Depends(get_db),
):
    """Add a role to an application's catalogue (mirroring a role the app defines)."""
    repo = ApplicationRepository(db)
    app = await _get_app_or_404(repo, app_id)
    if any(r.name.lower() == data.name.lower() for r in app.roles):
        raise HTTPException(status_code=409, detail=f"{app.name} already has a role '{data.name}'")

    if data.is_default:
        for r in app.roles:
            r.is_default = False
    role = AppRole(**data.model_dump(), source="manual")
    app.roles.append(role)
    await db.flush()

    await record_audit(
        db, action="create_app_role", resource_type="app_role", resource_id=role.id,
        actor=current_user, details={"application": app.name, "role": role.name,
                                     "external_role_id": role.external_role_id},
    )
    return AppRoleResponse.model_validate(role)


@router.patch("/{app_id}/roles/{role_id}", response_model=AppRoleResponse)
async def update_app_role(
    app_id: str, role_id: str, data: AppRoleUpdate,
    current_user: User = Depends(require_permission("applications.update")),
    db: AsyncSession = Depends(get_db),
):
    """Update an application role. Renaming updates the role shown on its assignments."""
    repo = ApplicationRepository(db)
    app = await _get_app_or_404(repo, app_id)
    role = next((r for r in app.roles if r.id == role_id), None)
    if not role:
        raise HTTPException(status_code=404, detail="Application role not found")

    changes = data.model_dump(exclude_unset=True)
    new_name = (changes.get("name") or "").strip()
    if new_name and new_name.lower() != role.name.lower():
        if any(r.name.lower() == new_name.lower() for r in app.roles):
            raise HTTPException(status_code=409, detail=f"{app.name} already has a role '{new_name}'")
        changes["name"] = new_name
    if changes.get("is_default"):
        for r in app.roles:
            r.is_default = False
    if "external_role_id" in changes and changes["external_role_id"] != role.external_role_id:
        role.sync_status = "unverified"

    before = {k: getattr(role, k) for k in changes}
    for key, value in changes.items():
        setattr(role, key, value)
    await db.flush()
    if "name" in changes:
        # Keep the role name shown on existing assignments in step with the catalogue.
        await db.execute(
            update(AppAssignment)
            .where(AppAssignment.app_role_id == role.id)
            .values(app_role=role.name)
        )

    await record_audit(
        db, action="update_app_role", resource_type="app_role", resource_id=role.id,
        actor=current_user, details={"application": app.name, "before": before, "after": changes},
    )
    return AppRoleResponse.model_validate(role)


@router.delete("/{app_id}/roles/{role_id}", status_code=204)
async def delete_app_role(
    app_id: str, role_id: str,
    current_user: User = Depends(require_permission("applications.update")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a role from the catalogue. Refused while employees still hold it."""
    repo = ApplicationRepository(db)
    app = await _get_app_or_404(repo, app_id)
    role = next((r for r in app.roles if r.id == role_id), None)
    if not role:
        raise HTTPException(status_code=404, detail="Application role not found")

    in_use = await repo.count_role_assignments(role.id)
    if in_use:
        raise HTTPException(
            status_code=409,
            detail=f"{in_use} employee(s) still hold '{role.name}'. Revoke it first.",
        )

    await record_audit(
        db, action="delete_app_role", resource_type="app_role", resource_id=role.id,
        actor=current_user, details={"application": app.name, "role": role.name},
    )
    app.roles.remove(role)
    await db.flush()
