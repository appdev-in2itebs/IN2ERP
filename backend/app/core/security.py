"""
In2IT ERP - Security Utilities
Password hashing, password policy and JWT token management.
"""

import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings

settings = get_settings()

COMMON_PASSWORDS = {
    "password", "password1", "password123", "admin123", "employee123", "welcome1",
    "welcome123", "qwerty123", "letmein123", "changeme123", "12345678910",
}


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))


def password_policy_errors(password: str) -> list[str]:
    """Return a list of policy violations (empty when the password is acceptable)."""
    errors = []
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        errors.append(f"must be at least {settings.PASSWORD_MIN_LENGTH} characters")
    if not any(c.isalpha() for c in password):
        errors.append("must contain a letter")
    if not any(c.isdigit() for c in password):
        errors.append("must contain a digit")
    if password.lower() in COMMON_PASSWORDS:
        errors.append("is too common")
    return errors


def generate_temporary_password(length: int = 16) -> str:
    """Generate a random password that satisfies the password policy."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^*-_"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        if not password_policy_errors(candidate):
            return candidate


def _encode(data: dict[str, Any], token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        **data,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    return _encode(
        data, "access", expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )


def create_refresh_token(data: dict[str, Any]) -> str:
    """Create a JWT refresh token."""
    return _encode(data, "refresh", timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))


def decode_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT token. Returns payload or None."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "iat", "sub", "type"]},
        )
    except jwt.PyJWTError:
        return None
