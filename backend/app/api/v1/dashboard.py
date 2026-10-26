"""
In2IT ERP - Dashboard API Routes
Aggregated stats for the dashboard view.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.repositories.audit_repository import AuditRepository
from app.repositories.user_repository import UserRepository

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    total_applications: int
    active_applications: int
    total_assignments: int
    recent_activity_count: int
    departments: list[str]


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated dashboard statistics."""
    user_repo = UserRepository(db)
    app_repo = ApplicationRepository(db)
    audit_repo = AuditRepository(db)

    total_employees = await user_repo.count()
    active_employees = await user_repo.count_active()
    total_applications = await app_repo.count()
    active_applications = await app_repo.count_active()
    total_assignments = await app_repo.total_assignments()
    recent_activity_count = await audit_repo.count()
    departments = await user_repo.get_departments()

    return DashboardStats(
        total_employees=total_employees,
        active_employees=active_employees,
        total_applications=total_applications,
        active_applications=active_applications,
        total_assignments=total_assignments,
        recent_activity_count=recent_activity_count,
        departments=departments,
    )
