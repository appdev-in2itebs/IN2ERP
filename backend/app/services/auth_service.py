"""
In2IT ERP - Auth Service
Local (password) authentication: login, refresh-token rotation, password change, logout.
Employee sign-in is intended to move to Microsoft Entra ID; see LOCAL_AUTH_MODE.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    COMMON_PASSWORDS,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    password_policy_errors,
    verify_password,
)
from app.models.role import UserRole
from app.models.session import RefreshToken
from app.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest, TokenResponse
from app.services.audit_service import commit_audit, record_audit

INVALID_CREDENTIALS = "Invalid email or password"
INVALID_REFRESH = "Session expired. Please sign in again."


def local_login_allowed(email: str) -> bool:
    """Whether password sign-in is permitted for this account under LOCAL_AUTH_MODE."""
    settings = get_settings()
    mode = settings.local_auth_mode
    if mode == "all":
        return True
    if mode == "break_glass_only":
        return email.lower() in {e.lower() for e in settings.BREAK_GLASS_EMAILS}
    return False


def ensure_password_policy(password: str) -> None:
    errors = password_policy_errors(password)
    if errors:
        raise HTTPException(status_code=422, detail="Password " + "; ".join(errors))


@dataclass
class IssuedSession:
    """Tokens for one sign-in: the body response and the refresh cookie value."""
    response: TokenResponse
    refresh_token: str


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()
        self.user_repo = UserRepository(db)

    # ── Sign-in ──

    async def login(self, request: LoginRequest) -> IssuedSession:
        """Authenticate with email and password."""
        now = datetime.now(timezone.utc)
        if not local_login_allowed(request.email):
            await commit_audit(
                self.db, action="login_failed", resource_type="auth", status="failure",
                actor_email=request.email, details={"reason": "local_login_disabled"},
            )
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Password sign-in is disabled. Sign in with Microsoft.",
            )

        user = await self.user_repo.get_by_email(request.email)
        if not user or not user.hashed_password:
            await commit_audit(
                self.db, action="login_failed", resource_type="auth", status="failure",
                actor_email=request.email, details={"reason": "unknown_account"},
            )
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

        if user.is_locked(now):
            await commit_audit(
                self.db, action="login_failed", resource_type="auth", status="failure",
                actor=user, details={"reason": "account_locked"},
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account temporarily locked after repeated failed sign-ins. "
                       "Try again later or ask an administrator to reset your password.",
            )

        if not verify_password(request.password, user.hashed_password):
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            details = {"reason": "invalid_password", "attempts": user.failed_login_attempts}
            if user.failed_login_attempts >= self.settings.LOGIN_MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=self.settings.LOGIN_LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
                details["locked_until"] = user.locked_until
            await commit_audit(
                self.db, action="login_failed", resource_type="auth", status="failure",
                actor=user, details=details,
            )
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

        if not user.is_active:
            await commit_audit(
                self.db, action="login_failed", resource_type="auth", status="failure",
                actor=user, details={"reason": "account_deactivated"},
            )
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        if request.password.lower() in COMMON_PASSWORDS:
            user.must_change_password = True  # a known/shared password must be replaced now
        await record_audit(self.db, action="login", resource_type="auth", actor=user)
        return await self._issue(user, family_id=uuid.uuid4().hex)

    async def register(self, request: RegisterRequest) -> IssuedSession:
        """Self-service registration (disabled unless ALLOW_SELF_REGISTRATION is set)."""
        if not self.settings.ALLOW_SELF_REGISTRATION:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Self-registration is disabled. Ask your ERP administrator for access.",
            )
        if await self.user_repo.get_by_email(request.email):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="User with this email already exists")
        ensure_password_policy(request.password)

        user = User(
            email=request.email,
            hashed_password=hash_password(request.password),
            password_changed_at=datetime.now(timezone.utc),
            first_name=request.first_name,
            last_name=request.last_name,
            department=request.department,
            designation=request.designation,
            phone=request.phone,
        )
        await self.user_repo.create(user)

        # Self-registered accounts receive only the baseline Employee role.
        employee_role = await RoleRepository(self.db).get_role_by_name("Employee")
        if employee_role:
            self.db.add(UserRole(user_id=user.id, role_id=employee_role.id))
            await self.db.flush()

        await record_audit(self.db, action="register", resource_type="auth", actor=user)
        return await self._issue(user, family_id=uuid.uuid4().hex)

    # ── Refresh-token rotation ──

    async def refresh(self, refresh_token: str | None) -> IssuedSession:
        """
        Exchange a refresh token for a new access token and a new refresh token.
        Each refresh token works once. Presenting one that was already used means it
        was copied: the whole token family is revoked and the user must sign in again.
        """
        payload = decode_token(refresh_token) if refresh_token else None
        if not payload or payload.get("type") != "refresh" or not payload.get("jti"):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_REFRESH)

        record = await self.db.get(RefreshToken, payload["jti"])
        user = await self.user_repo.get_by_id(payload["sub"])
        if not record or not user or record.user_id != user.id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_REFRESH)

        now = datetime.now(timezone.utc)
        if record.used_at or record.revoked_at:
            if record.used_at and not record.revoked_at:
                await self._revoke_family(record.family_id, now)
                await commit_audit(
                    self.db, action="refresh_token_replay", resource_type="auth",
                    status="failure", actor=user, details={"family_id": record.family_id},
                )
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_REFRESH)

        if (
            not user.is_active
            or payload.get("tv") != user.token_version
            or not local_login_allowed(user.email)
        ):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_REFRESH)

        record.used_at = now
        issued = await self._issue(user, family_id=record.family_id)
        record.replaced_by = decode_token(issued.refresh_token)["jti"]
        return issued

    # ── Password & sign-out ──

    async def change_password(self, user: User, request: ChangePasswordRequest) -> IssuedSession:
        """Change the caller's password; every other session is signed out."""
        if not user.hashed_password or not verify_password(
            request.current_password, user.hashed_password
        ):
            await commit_audit(
                self.db, action="change_password", resource_type="auth", status="failure",
                actor=user, details={"reason": "invalid_current_password"},
            )
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
        if request.new_password == request.current_password:
            raise HTTPException(422, detail="New password must differ from the current password")
        ensure_password_policy(request.new_password)

        user.hashed_password = hash_password(request.new_password)
        user.password_changed_at = datetime.now(timezone.utc)
        user.must_change_password = False
        await self.revoke_all_sessions(user)
        await record_audit(self.db, action="change_password", resource_type="auth", actor=user)
        return await self._issue(user, family_id=uuid.uuid4().hex)

    async def logout(self, user: User) -> None:
        """Sign out of every session: all access and refresh tokens stop working."""
        await self.revoke_all_sessions(user)
        await record_audit(self.db, action="logout", resource_type="auth", actor=user)

    async def revoke_all_sessions(self, user: User) -> None:
        user.revoke_sessions()
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )

    # ── Internals ──

    async def _revoke_family(self, family_id: str, now: datetime) -> None:
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    async def _issue(self, user: User, family_id: str) -> IssuedSession:
        await self.db.flush()  # token_version must be populated for new users
        token_data = {"sub": user.id, "tv": user.token_version}
        refresh = create_refresh_token(token_data)
        claims = decode_token(refresh)
        self.db.add(RefreshToken(
            id=claims["jti"], user_id=user.id, family_id=family_id,
            expires_at=datetime.fromtimestamp(claims["exp"], tz=timezone.utc),
        ))
        await self.db.flush()
        return IssuedSession(
            response=TokenResponse(
                access_token=create_access_token(token_data),
                expires_in=self.settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                must_change_password=user.must_change_password,
            ),
            refresh_token=refresh,
        )
