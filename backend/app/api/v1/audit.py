"""
In2IT ERP - Audit API Routes
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import require_permission
from app.db.database import get_db
from app.models.user import User
from app.schemas.audit import AuditLogListResponse
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user_id: str | None = None,
    action: str | None = None,
    resource_type: str | None = None,
    current_user: User = Depends(require_permission("audit.read")),
    db: AsyncSession = Depends(get_db),
):
    """List audit logs with filtering and pagination."""
    service = AuditService(db)
    return await service.get_logs(
        page=page, per_page=per_page,
        user_id=user_id, action=action, resource_type=resource_type
    )
