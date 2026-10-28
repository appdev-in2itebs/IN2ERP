"""
In2IT ERP - Access Service
Grant, revoke and track employees' application roles.

Each AppAssignment row is one application role held by one employee. A change of intent
bumps the row's `version` and, for integrated applications, queues a provisioning job in
the same transaction. The row's `provisioning_status` reports what the target application
has confirmed; the ERP never reports a grant or revocation as done before that.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import AppAssignment, Application
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository, effective_filter
from app.repositories.user_repository import UserRepository
from app.schemas.application import AssignmentResponse
from app.services.audit_service import record_audit
from app.services.authorization_service import ensure_can_manage_user
from app.services.provisioning_service import GRANT, REVOKE, enqueue, pending_status

RETRYABLE = ("failed", "reconciliation_required")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def to_response(assignment: AppAssignment, user: User | None = None) -> AssignmentResponse:
    user = user or assignment.user
    return AssignmentResponse(
        id=assignment.id, user_id=assignment.user_id,
        application_id=assignment.application_id,
        app_role_id=assignment.app_role_id,
        app_role=assignment.app_role or "Member",
        status=assignment.status,
        provisioning_status=assignment.provisioning_status,
        last_error=assignment.last_error,
        last_verified_at=assignment.last_verified_at,
        assigned_at=assignment.assigned_at,
        assigned_by=assignment.assigned_by, expires_at=assignment.expires_at,
        revoked_at=assignment.revoked_at,
        notes=assignment.notes,
        user_name=user.full_name if user else None,
        user_email=user.email if user else None,
        application_name=assignment.application.name if assignment.application else None,
        integration_type=assignment.application.integration_type if assignment.application else None,
    )


@dataclass
class PlannedChange:
    action: str  # "grant" | "revoke"
    application_id: str
    application_name: str
    app_role_id: str
    app_role: str
    assignment_id: str | None = None
    expires_at: datetime | None = None
    notes: str | None = None
    integration_type: str = "manual"
    outcome: str = ""  # what will happen in the target application

    def as_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


@dataclass
class ChangePlan:
    user: User
    changes: list[PlannedChange] = field(default_factory=list)


class AccessService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.app_repo = ApplicationRepository(db)
        self.user_repo = UserRepository(db)

    # ── Planning (validation without side effects) ──

    async def plan(
        self, actor: User, user_id: str, grants: list[dict], revokes: list[str]
    ) -> ChangePlan:
        """
        Validate a set of explicit grants and revocations for one employee.
        Any unknown application, role or assignment rejects the whole request.
        """
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        ensure_can_manage_user(actor, user)
        if grants and not user.is_active:
            raise HTTPException(status_code=400, detail="Cannot grant access to a deactivated employee")

        current = await self.app_repo.get_user_assignments(user.id, include_revoked=True)
        plan = ChangePlan(user=user)
        errors: list[str] = []
        seen: set[tuple[str, str]] = set()
        apps_in_plan: set[str] = set()

        for item in grants:
            app = await self.app_repo.get_by_id(item.get("application_id") or "")
            if not app:
                errors.append(f"Unknown application: {item.get('application_id')}")
                continue
            if not app.is_active:
                errors.append(f"{app.name} is not active")
                continue
            role = next((r for r in app.roles if r.id == item.get("app_role_id")), None)
            if not role:
                errors.append(f"Unknown role {item.get('app_role_id')} for {app.name}")
                continue
            if (app.id, role.id) in seen:
                errors.append(f"{app.name} / {role.name} is listed twice")
                continue
            seen.add((app.id, role.id))

            expires_at = _aware(item.get("expires_at"))
            if expires_at and expires_at <= _utcnow():
                errors.append(f"Expiry for {app.name} / {role.name} is in the past")
                continue

            existing = next(
                (a for a in current if a.application_id == app.id and a.app_role_id == role.id), None
            )
            if existing and existing.is_effective():
                errors.append(f"{user.full_name} already holds {app.name} / {role.name}")
                continue

            # max_users counts people: a second role in the same app does not use a seat.
            holds_app = app.id in apps_in_plan or any(
                a.application_id == app.id and a.is_effective() for a in current
            )
            if app.max_users and not holds_app:
                if await self._user_count(app.id) >= app.max_users:
                    errors.append(f"{app.name} has reached its maximum of {app.max_users} users")
                    continue
            apps_in_plan.add(app.id)

            plan.changes.append(PlannedChange(
                action=GRANT, application_id=app.id, application_name=app.name,
                app_role_id=role.id, app_role=role.name, assignment_id=existing.id if existing else None,
                expires_at=expires_at, notes=item.get("notes"),
                integration_type=app.integration_type,
                outcome=self._outcome(app, GRANT),
            ))

        by_id = {a.id: a for a in current}
        for assignment_id in revokes:
            assignment = by_id.get(assignment_id)
            if not assignment:
                errors.append(f"Unknown assignment: {assignment_id}")
                continue
            if assignment.status != "active":
                errors.append(f"{assignment.application.name} / {assignment.app_role} is already {assignment.status}")
                continue
            plan.changes.append(PlannedChange(
                action=REVOKE, application_id=assignment.application_id,
                application_name=assignment.application.name,
                app_role_id=assignment.app_role_id or "", app_role=assignment.app_role,
                assignment_id=assignment.id, integration_type=assignment.application.integration_type,
                outcome=self._outcome(assignment.application, REVOKE),
            ))

        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        if not plan.changes:
            raise HTTPException(status_code=400, detail="No changes requested")
        return plan

    @staticmethod
    def _outcome(app: Application, action: str) -> str:
        if app.integration_type == "manual":
            verb = "grant" if action == GRANT else "remove"
            return f"Manual: an app owner must {verb} this role in {app.name} and confirm it"
        if app.integration_status in ("unconfigured", "error"):
            return f"Will be queued, but the {app.name} connector is {app.integration_status}"
        return f"Queued for the {app.integration_type} connector, then verified in {app.name}"

    async def _user_count(self, app_id: str) -> int:
        result = await self.db.execute(
            select(func.count(func.distinct(AppAssignment.user_id)))
            .where(AppAssignment.application_id == app_id)
            .where(effective_filter())
        )
        return result.scalar()

    # ── Applying ──

    async def apply(self, plan: ChangePlan, actor: User) -> list[AppAssignment]:
        touched: list[AppAssignment] = []
        for change in plan.changes:
            if change.action == GRANT:
                touched.append(await self._grant(plan.user, change, actor))
            else:
                assignment = await self.app_repo.get_assignment_by_id(change.assignment_id)
                touched.append(await self.revoke(assignment, actor, reason="admin"))
        return touched

    async def grant_one(self, actor: User, user_id: str, application_id: str, app_role_id: str,
                        expires_at: datetime | None = None, notes: str | None = None) -> AppAssignment:
        plan = await self.plan(actor, user_id, [{
            "application_id": application_id, "app_role_id": app_role_id,
            "expires_at": expires_at, "notes": notes,
        }], [])
        return (await self.apply(plan, actor))[0]

    async def _grant(self, user: User, change: PlannedChange, actor: User) -> AppAssignment:
        app = await self.app_repo.get_by_id(change.application_id)
        role = next(r for r in app.roles if r.id == change.app_role_id)

        if change.assignment_id:
            # Re-grant a previously revoked/expired role (one row per user, app and role).
            assignment = await self.app_repo.get_assignment_by_id(change.assignment_id)
            assignment.version += 1
            assignment.revoked_at = None
            assignment.revoked_by = None
        else:
            assignment = AppAssignment(user_id=user.id, application_id=app.id, version=1)
            assignment.application = app
            assignment.user = user
            self.db.add(assignment)

        assignment.status = "active"
        assignment.app_role_id = role.id
        assignment.app_role = role.name
        assignment.role = role
        assignment.assigned_by = actor.id
        assignment.assigned_at = _utcnow()
        assignment.expires_at = change.expires_at
        assignment.notes = change.notes if change.notes is not None else assignment.notes
        assignment.provisioning_status = pending_status(app, GRANT)
        assignment.last_error = None
        await self.db.flush()
        await enqueue(self.db, assignment, GRANT, requested_by=actor.id)

        await record_audit(
            self.db, action="grant_app_access", resource_type="assignment",
            resource_id=assignment.id, actor=actor,
            details={
                "user_email": user.email, "application": app.name, "app_role": role.name,
                "expires_at": change.expires_at, "integration": app.integration_type,
                "provisioning_status": assignment.provisioning_status,
            },
        )
        return assignment

    async def revoke(self, assignment: AppAssignment, actor: User | None, reason: str) -> AppAssignment:
        if assignment.status != "active":
            raise HTTPException(status_code=400, detail=f"Assignment is already {assignment.status}")
        assignment.status = "revoked"
        assignment.version += 1
        assignment.revoked_at = _utcnow()
        assignment.revoked_by = actor.id if actor else None
        assignment.provisioning_status = pending_status(assignment.application, REVOKE)
        assignment.last_error = None
        await self.db.flush()
        await enqueue(self.db, assignment, REVOKE, requested_by=actor.id if actor else None)

        await record_audit(
            self.db, action="revoke_app_access", resource_type="assignment",
            resource_id=assignment.id, actor=actor,
            actor_email=None if actor else "system",
            details={
                "user_email": assignment.user.email if assignment.user else None,
                "application": assignment.application.name,
                "app_role": assignment.app_role, "reason": reason,
                "provisioning_status": assignment.provisioning_status,
            },
        )
        return assignment

    async def revoke_all_for_user(self, user: User, actor: User, reason: str) -> int:
        """Start removing every role the employee holds (used on deactivation)."""
        count = 0
        for assignment in await self.app_repo.get_user_assignments(user.id):
            if assignment.status == "active":
                await self.revoke(assignment, actor, reason=reason)
                count += 1
        return count

    # ── Follow-up actions ──

    async def update_details(self, assignment: AppAssignment, actor: User,
                             changes: dict) -> AppAssignment:
        """Change notes or expiry. Changing the role is a revoke plus a grant."""
        ensure_can_manage_user(actor, assignment.user)
        if assignment.status != "active":
            raise HTTPException(status_code=400, detail="Only active assignments can be edited")
        before = {"notes": assignment.notes, "expires_at": assignment.expires_at}
        if "expires_at" in changes:
            expires_at = _aware(changes["expires_at"])
            if expires_at and expires_at <= _utcnow():
                raise HTTPException(status_code=400, detail="Expiry must be in the future")
            assignment.expires_at = expires_at
        if "notes" in changes:
            assignment.notes = changes["notes"]
        await self.db.flush()
        await record_audit(
            self.db, action="update_app_access", resource_type="assignment",
            resource_id=assignment.id, actor=actor,
            details={"user_email": assignment.user.email, "application": assignment.application.name,
                     "app_role": assignment.app_role, "before": before, "after": changes},
        )
        return assignment

    async def confirm_manual(self, assignment: AppAssignment, actor: User, note: str | None) -> AppAssignment:
        """An app owner attests that a manual application now reflects the change."""
        ensure_can_manage_user(actor, assignment.user)
        if assignment.provisioning_status != "manual_action_required":
            raise HTTPException(status_code=400, detail="This change is not awaiting manual confirmation")
        assignment.provisioning_status = "verified" if assignment.status == "active" else "revoked"
        assignment.last_verified_at = _utcnow()
        assignment.last_error = None
        await self.db.flush()
        await record_audit(
            self.db, action="manual_confirmation", resource_type="assignment",
            resource_id=assignment.id, actor=actor,
            details={"user_email": assignment.user.email, "application": assignment.application.name,
                     "app_role": assignment.app_role, "result": assignment.provisioning_status,
                     "note": note},
        )
        return assignment

    async def retry(self, assignment: AppAssignment, actor: User) -> AppAssignment:
        """Queue a fresh attempt for a failed or unreconciled assignment."""
        ensure_can_manage_user(actor, assignment.user)
        if assignment.provisioning_status not in RETRYABLE:
            raise HTTPException(status_code=400, detail="Only failed or unreconciled changes can be retried")
        if assignment.application.integration_type == "manual":
            raise HTTPException(status_code=400, detail="Manual applications are confirmed, not retried")
        operation = GRANT if assignment.is_effective() else REVOKE
        assignment.provisioning_status = pending_status(assignment.application, operation)
        await enqueue(self.db, assignment, operation, requested_by=actor.id)
        await record_audit(
            self.db, action="retry_provisioning", resource_type="assignment",
            resource_id=assignment.id, actor=actor,
            details={"operation": operation, "application": assignment.application.name,
                     "user_email": assignment.user.email, "app_role": assignment.app_role},
        )
        return assignment


def summarise_launchpad(assignments: list[AppAssignment]) -> list[dict]:
    """
    Group an employee's effective assignments by application for the launchpad.
    An application is launchable only once at least one role is verified in the target.
    """
    now = _utcnow()
    by_app: dict[str, dict] = {}
    for a in assignments:
        if not a.is_effective(now) or not a.application or not a.application.is_active:
            continue
        entry = by_app.setdefault(a.application_id, {"app": a.application, "roles": [], "states": set()})
        entry["roles"].append(a.app_role)
        entry["states"].add(a.provisioning_status)

    result = []
    for entry in by_app.values():
        states = entry["states"]
        if "verified" in states:
            state, message = "ready", None
        elif states == {"failed"}:
            state, message = "failed", "Access could not be set up. Your administrator has been notified."
        else:
            state, message = "pending", "Your access is being set up and is not available yet."
        result.append({"app": entry["app"], "roles": sorted(entry["roles"]),
                       "access_state": state, "status_message": message})
    return sorted(result, key=lambda e: (e["app"].sort_order, e["app"].name))
