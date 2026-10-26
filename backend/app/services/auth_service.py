"""
In2IT ERP - Auth Service
Handles authentication: login, registration, token refresh.
"""

import json
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.audit import AuditLog
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.audit_repo = AuditRepository(db)

    async def login(self, request: LoginRequest, ip_address: str | None = None) -> TokenResponse:
        """Authenticate user and return JWT tokens."""
        user = await self.user_repo.get_by_email(request.email)

        if not user or not user.hashed_password:
            await self._log_audit(
                action="login_failed", resource_type="auth",
                details=json.dumps({"email": request.email, "reason": "user_not_found"}),
                ip_address=ip_address, status="failure"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not verify_password(request.password, user.hashed_password):
            await self._log_audit(
                action="login_failed", resource_type="auth",
                user_id=user.id, user_email=user.email,
                details=json.dumps({"reason": "invalid_password"}),
                ip_address=ip_address, status="failure"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()

        tokens = self._create_tokens(user)

        await self._log_audit(
            action="login", resource_type="auth",
            user_id=user.id, user_email=user.email,
            ip_address=ip_address
        )

        return tokens

    async def register(
        self, request: RegisterRequest, ip_address: str | None = None
    ) -> TokenResponse:
        """Register a new user."""
        existing = await self.user_repo.get_by_email(request.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists",
            )

        user = User(
            email=request.email,
            hashed_password=hash_password(request.password),
            first_name=request.first_name,
            last_name=request.last_name,
            department=request.department,
            designation=request.designation,
            phone=request.phone,
        )

        await self.user_repo.create(user)
        tokens = self._create_tokens(user)

        await self._log_audit(
            action="register", resource_type="auth",
            user_id=user.id, user_email=user.email,
            ip_address=ip_address
        )

        return tokens

    async def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Issue new tokens from a valid refresh token."""
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        user = await self.user_repo.get_by_id(payload["sub"])
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        return self._create_tokens(user)

    def _create_tokens(self, user: User) -> TokenResponse:
        """Generate access and refresh tokens for a user."""
        token_data = {
            "sub": user.id,
            "email": user.email,
            "is_superadmin": user.is_superadmin,
        }
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
        )

    async def _log_audit(self, **kwargs):
        log = AuditLog(**kwargs)
        await self.audit_repo.create(log)
