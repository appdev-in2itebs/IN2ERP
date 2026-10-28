"""
In2IT ERP - Auth API Routes

Session model for local (password) sign-in:
- The access token (short-lived) is returned in the response body; the SPA keeps it in memory.
- The refresh token is set as an HttpOnly, SameSite=Strict cookie scoped to /auth, so page
  scripts can never read it. /auth/refresh additionally requires the X-Requested-With
  header, which cross-site forms cannot send, as CSRF protection.
- Refresh tokens rotate on every use; replaying an old one revokes the whole family.

Entra sessions do not use these endpoints for tokens: MSAL obtains Entra access tokens
and the API validates them directly (see dependencies.py).
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import Principal, effective_permissions, get_current_user, get_principal
from app.core.config import get_settings
from app.core.entra import ENTRA_AUTHORITY
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthConfigResponse, ChangePasswordRequest, EntraClientConfig, LoginRequest,
    RegisterRequest, TokenResponse,
)
from app.schemas.user import UserAppAssignmentDetail, UserWithRoles
from app.services.auth_service import AuthService, IssuedSession

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()

CSRF_HEADER_VALUE = "In2ERP"


def _cookie_path() -> str:
    return f"{settings.API_V1_PREFIX}/auth"


def _set_refresh_cookie(response: Response, session: IssuedSession) -> TokenResponse:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=session.refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path=_cookie_path(),
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite="strict",
    )
    return session.response


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME, path=_cookie_path(),
        httponly=True, secure=settings.refresh_cookie_secure, samesite="strict",
    )


def _require_csrf_header(x_requested_with: str | None) -> None:
    if x_requested_with != CSRF_HEADER_VALUE:
        raise HTTPException(status_code=403, detail="Missing X-Requested-With header")


@router.get("/config", response_model=AuthConfigResponse)
async def auth_config():
    """Public sign-in options for the login screen (no secrets)."""
    entra = None
    if settings.entra_enabled:
        entra = EntraClientConfig(
            client_id=settings.ENTRA_SPA_CLIENT_ID,
            authority=f"{ENTRA_AUTHORITY}/{settings.ENTRA_TENANT_ID}",
            api_scope=f"{settings.entra_audience}/{settings.ENTRA_API_SCOPE}",
        )
    return AuthConfigResponse(
        self_registration_enabled=settings.ALLOW_SELF_REGISTRATION,
        password_min_length=settings.PASSWORD_MIN_LENGTH,
        local_login_enabled=settings.local_auth_mode != "disabled",
        entra_enabled=settings.entra_enabled,
        entra=entra,
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Password sign-in (subject to LOCAL_AUTH_MODE)."""
    return _set_refresh_cookie(response, await AuthService(db).login(request))


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(request: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Create a new user account (only when self-registration is enabled)."""
    return _set_refresh_cookie(response, await AuthService(db).register(request))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_cookie: str | None = Cookie(default=None, alias=settings.REFRESH_COOKIE_NAME),
    x_requested_with: str | None = Header(default=None),
):
    """Rotate the refresh-token cookie and return a new access token."""
    _require_csrf_header(x_requested_with)
    try:
        session = await AuthService(db).refresh(refresh_cookie)
    except HTTPException:
        _clear_refresh_cookie(response)
        raise
    return _set_refresh_cookie(response, session)


@router.post("/change-password", response_model=TokenResponse)
async def change_password(
    request: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the caller's password. Every other session is signed out."""
    return _set_refresh_cookie(response, await AuthService(db).change_password(current_user, request))


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sign out of every session: all access and refresh tokens are revoked."""
    await AuthService(db).logout(current_user)
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserWithRoles)
async def get_me(
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    """The signed-in user with effective permissions and current application access."""
    current_user = principal.user
    permissions = await effective_permissions(db, principal)
    now = datetime.now(timezone.utc)

    roles = [
        {"id": ur.role.id, "name": ur.role.name, "color": ur.role.color}
        for ur in current_user.role_assignments
    ]
    assignments_detail = [
        UserAppAssignmentDetail(
            application_slug=a.application_slug,
            application_name=a.application_name,
            app_role=a.app_role,
            status=a.status,
            provisioning_status=a.provisioning_status,
        )
        for a in current_user.app_assignments
        if a.is_effective(now)
    ]

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
        is_superadmin=current_user.is_superadmin and principal.admin_capable,
        must_change_password=current_user.must_change_password and principal.method == "local",
        entra_linked=bool(current_user.entra_id),
        auth_method=principal.method,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        last_login_at=current_user.last_login_at,
        primary_role=current_user.primary_role,
        role_names=current_user.role_names,
        app_assignments=assignments_detail,
        roles=roles,
        permissions=sorted(permissions),
    )
