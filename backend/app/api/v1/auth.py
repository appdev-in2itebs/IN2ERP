"""
In2IT ERP - Auth API Routes
Login, register, refresh, and current user endpoints.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse, UserWithRoles
from app.services.auth_service import AuthService
from app.services.authorization_service import AuthorizationService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, req: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate and receive JWT tokens."""
    service = AuthService(db)
    ip = req.client.host if req.client else None
    return await service.login(request, ip_address=ip)


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(request: RegisterRequest, req: Request, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    service = AuthService(db)
    ip = req.client.host if req.client else None
    return await service.register(request, ip_address=ip)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Refresh an expired access token."""
    service = AuthService(db)
    return await service.refresh_token(request.refresh_token)


@router.get("/me", response_model=UserWithRoles)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current authenticated user with roles and permissions."""
    authz = AuthorizationService(db)
    permissions = await authz.get_user_permissions(current_user.id)

    roles = []
    for ur in current_user.role_assignments:
        roles.append({
            "id": ur.role.id,
            "name": ur.role.name,
            "color": ur.role.color,
        })

    return UserWithRoles(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        department=current_user.department,
        designation=current_user.designation,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        is_superadmin=current_user.is_superadmin,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        last_login_at=current_user.last_login_at,
        roles=roles,
        permissions=list(permissions),
    )
