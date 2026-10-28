"""
In2IT ERP - API Dependencies
Shared FastAPI dependencies: the authenticated principal and permission checks.

Two kinds of bearer token are accepted:
- local ERP tokens (HS256) for password sign-in while LOCAL_AUTH_MODE allows it
- Microsoft Entra access tokens (RS256) once Entra is configured

ERP administrator policy, enforced here for every endpoint:
- Admin permissions come only from ERP roles/overrides held in the database.
- For Entra sessions they additionally require the ENTRA_ADMIN_APP_ROLE app role in the
  token; without it the session has baseline employee permissions only.
"""

from dataclasses import dataclass, field

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.entra import EntraTokenError, get_entra_validator, looks_like_entra_token
from app.core.security import decode_token
from app.db.database import get_db
from app.db.seed import DEFAULT_PERMISSIONS
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.audit_service import commit_audit
from app.services.auth_service import local_login_allowed
from app.services.authorization_service import AuthorizationService
from app.services.identity_service import resolve_entra_user, touch_last_login

security_scheme = HTTPBearer()

# Permissions every signed-in employee has regardless of admin authorisation.
BASELINE_PERMISSIONS = frozenset({"dashboard.read", "applications.read"})
ALL_PERMISSIONS = frozenset(code for code, *_ in DEFAULT_PERMISSIONS)

# Endpoints a user may call while a password change is pending.
PASSWORD_CHANGE_ALLOWED_PATHS = ("/auth/me", "/auth/change-password", "/auth/logout")

INVALID_TOKEN = "Invalid or expired token"


@dataclass
class Principal:
    user: User
    method: str  # "local" | "entra"
    entra_roles: list[str] = field(default_factory=list)

    @property
    def admin_capable(self) -> bool:
        """Whether this session may exercise ERP administration permissions at all."""
        if self.method == "entra":
            return get_settings().ENTRA_ADMIN_APP_ROLE in self.entra_roles
        return True


async def _authenticate_local(token: str, db: AsyncSession) -> Principal:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_TOKEN)

    user = await UserRepository(db).get_by_id(payload["sub"])
    # A token minted before the user's sessions were revoked is no longer valid.
    if not user or payload.get("tv") != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_TOKEN)
    # Switching to Entra-only sign-in ends existing password sessions too.
    if not local_login_allowed(user.email):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Password sign-in is disabled")
    return Principal(user=user, method="local")


async def _authenticate_entra(token: str, db: AsyncSession) -> Principal:
    settings = get_settings()
    try:
        identity = await get_entra_validator(settings).validate(token)
    except EntraTokenError:
        # The reason is not disclosed to the caller.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_TOKEN) from None
    user = await resolve_entra_user(db, identity)
    await touch_last_login(user)
    return Principal(user=user, method="entra", entra_roles=identity.roles)


async def get_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    token = credentials.credentials
    if looks_like_entra_token(token):
        if not get_settings().entra_enabled:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_TOKEN)
        principal = await _authenticate_entra(token, db)
    else:
        principal = await _authenticate_local(token, db)

    user = principal.user
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    if principal.method == "local" and user.must_change_password:
        prefix = get_settings().API_V1_PREFIX
        allowed = tuple(prefix + p for p in PASSWORD_CHANGE_ALLOWED_PATHS)
        if not request.url.path.startswith(allowed):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Password change required")

    request.state.principal = principal
    return principal


async def get_current_user(principal: Principal = Depends(get_principal)) -> User:
    return principal.user


async def effective_permissions(db: AsyncSession, principal: Principal) -> set[str]:
    """Permissions this session may exercise, after the admin policy is applied."""
    perms = await AuthorizationService(db).get_user_permissions(principal.user.id)
    if principal.user.is_superadmin and principal.admin_capable:
        perms |= ALL_PERMISSIONS
    if not principal.admin_capable:
        perms &= BASELINE_PERMISSIONS
    return perms


async def get_current_superadmin(principal: Principal = Depends(get_principal)) -> User:
    """Require superadmin privileges."""
    if not (principal.user.is_superadmin and principal.admin_capable):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Superadmin access required")
    return principal.user


def require_permission(permission_code: str):
    """Factory: create a dependency that checks for a specific permission."""

    async def checker(
        request: Request,
        principal: Principal = Depends(get_principal),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        user = principal.user
        if user.is_superadmin and principal.admin_capable:
            return user

        allowed = permission_code in BASELINE_PERMISSIONS or principal.admin_capable
        if allowed:
            allowed = await AuthorizationService(db).has_permission(user.id, permission_code)
        if not allowed:
            await commit_audit(
                db, action="permission_denied", resource_type="authorization",
                actor=user, status="failure",
                details={
                    "permission": permission_code,
                    "method": request.method,
                    "path": request.url.path,
                    "auth_method": principal.method,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_code}' required",
            )
        return user

    return checker
