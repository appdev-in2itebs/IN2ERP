"""
In2IT ERP - Assignment Service
Business logic for application-to-user assignments.
"""

import json

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import AppAssignment
from app.models.audit import AuditLog
from app.repositories.application_repository import ApplicationRepository
from app.repositories.audit_repository import AuditRepository
from app.repositories.user_repository import UserRepository
from app.schemas.application import AssignmentCreate, AssignmentResponse, AssignmentUpdate


class AssignmentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.app_repo = ApplicationRepository(db)
        self.user_repo = UserRepository(db)
        self.audit_repo = AuditRepository(db)

    async def create_assignment(
        self, data: AssignmentCreate, assigned_by: str
    ) -> AssignmentResponse:
        """Assign an application to a user."""
        # Validate user exists
        user = await self.user_repo.get_by_id(data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Validate application exists
        app = await self.app_repo.get_by_id(data.application_id)
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        if not app.is_active:
            raise HTTPException(status_code=400, detail="Application is not active")

        # Check max users limit
        if app.max_users:
            current_count = await self.app_repo.get_assigned_user_count(app.id)
            if current_count >= app.max_users:
                raise HTTPException(
                    status_code=400, detail="Application has reached maximum user limit"
                )

        assignment = AppAssignment(
            user_id=data.user_id,
            application_id=data.application_id,
            app_role=data.app_role,
            assigned_by=assigned_by,
            notes=data.notes,
            expires_at=data.expires_at,
        )

        await self.app_repo.create_assignment(assignment)

        # Audit
        await self.audit_repo.create(AuditLog(
            user_id=assigned_by, action="assign_app",
            resource_type="assignment", resource_id=assignment.id,
            details=json.dumps({
                "user_id": data.user_id, "app_id": data.application_id,
                "app_name": app.name, "app_role": data.app_role
            })
        ))

        return AssignmentResponse(
            id=assignment.id, user_id=assignment.user_id,
            application_id=assignment.application_id,
            app_role=assignment.app_role,
            status=assignment.status, assigned_at=assignment.assigned_at,
            assigned_by=assignment.assigned_by, expires_at=assignment.expires_at,
            notes=assignment.notes, user_name=user.full_name,
            user_email=user.email, application_name=app.name,
        )

    async def update_assignment(
        self, assignment_id: str, data: AssignmentUpdate, updated_by: str
    ) -> AssignmentResponse:
        assignment = await self.app_repo.get_assignment_by_id(assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        update_data = data.model_dump(exclude_unset=True)
        await self.app_repo.update_assignment(assignment, update_data)

        await self.audit_repo.create(AuditLog(
            user_id=updated_by, action="update_assignment",
            resource_type="assignment", resource_id=assignment_id,
            details=json.dumps(update_data)
        ))

        return AssignmentResponse(
            id=assignment.id, user_id=assignment.user_id,
            application_id=assignment.application_id,
            app_role=assignment.app_role,
            status=assignment.status, assigned_at=assignment.assigned_at,
            assigned_by=assignment.assigned_by, expires_at=assignment.expires_at,
            notes=assignment.notes,
            user_name=assignment.user.full_name if assignment.user else None,
            user_email=assignment.user.email if assignment.user else None,
            application_name=assignment.application.name if assignment.application else None,
        )

    async def delete_assignment(self, assignment_id: str, deleted_by: str) -> None:
        assignment = await self.app_repo.get_assignment_by_id(assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        await self.audit_repo.create(AuditLog(
            user_id=deleted_by, action="delete_assignment",
            resource_type="assignment", resource_id=assignment_id,
            details=json.dumps({
                "user_id": assignment.user_id,
                "app_id": assignment.application_id
            })
        ))

        await self.app_repo.delete_assignment(assignment)

    async def sync_user_assignments(
        self,
        user_id: str,
        assignments_data: list[dict],
        assigned_by: str,
    ) -> list[AppAssignment]:
        from datetime import datetime, timezone
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        existing = await self.app_repo.get_user_assignments(user_id)
        existing_map = {a.application_id: a for a in existing}

        all_apps = await self.app_repo.list_applications()
        app_by_slug = {app.slug: app for app in all_apps}
        app_by_id = {app.id: app for app in all_apps}

        synced_app_ids = set()

        for item in assignments_data:
            app = None
            if item.get("application_id") and item["application_id"] in app_by_id:
                app = app_by_id[item["application_id"]]
            elif item.get("application_slug") and item["application_slug"] in app_by_slug:
                app = app_by_slug[item["application_slug"]]

            if not app:
                continue

            synced_app_ids.add(app.id)
            app_role = item.get("app_role", "Member")
            status = item.get("status", "active")

            if app.id in existing_map:
                existing_assignment = existing_map[app.id]
                existing_assignment.app_role = app_role
                existing_assignment.status = status
            else:
                new_assignment = AppAssignment(
                    user_id=user_id,
                    application_id=app.id,
                    app_role=app_role,
                    status=status,
                    assigned_at=datetime.now(timezone.utc),
                    assigned_by=assigned_by,
                )
                await self.app_repo.create_assignment(new_assignment)

        # Remove assignments that were unselected/unassigned
        for app_id, assignment in existing_map.items():
            if app_id not in synced_app_ids:
                await self.app_repo.delete_assignment(assignment)

        await self.db.flush()
        return await self.app_repo.get_user_assignments(user_id)
