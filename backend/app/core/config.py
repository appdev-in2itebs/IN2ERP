"""
In2IT ERP - Core Configuration
Centralized settings management using Pydantic Settings.
Supports SQLite (dev) and PostgreSQL (prod) via DATABASE_URL.
"""

import logging
import secrets
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("in2erp.config")

# Resolve .env files relative to this file, not the process working directory.
BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent

# Placeholder values that must never be used to sign tokens.
INSECURE_SECRETS = {"", "change-me", "change-me-jwt", "secret", "changeme"}
MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "In2IT-ERP"
    APP_ENV: str = "development"
    DEBUG: bool = False
    SECRET_KEY: str = ""
    API_V1_PREFIX: str = "/api/v1"
    ENABLE_API_DOCS: bool | None = None  # None = enabled outside production

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./in2it_erp.db"
    SQL_ECHO: bool = False

    # JWT
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS (explicit origins only; "*" is dropped because credentials are allowed)
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Proxy: trust X-Forwarded-For only when running behind a known reverse proxy
    TRUST_PROXY_HEADERS: bool = False

    # Account security
    ALLOW_SELF_REGISTRATION: bool = False
    PASSWORD_MIN_LENGTH: int = 10
    LOGIN_MAX_FAILED_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # Seeding (bootstrap data for an empty database)
    SEED_ON_STARTUP: bool | None = None  # None = seed outside production only
    SEED_ADMIN_EMAIL: str = "admin@in2it.com"
    SEED_ADMIN_PASSWORD: str | None = None  # None = generate a one-time password
    SEED_DEMO_DATA: bool = False

    # Refresh tokens are held in an HttpOnly cookie scoped to the auth endpoints.
    REFRESH_COOKIE_NAME: str = "in2erp_refresh"
    REFRESH_COOKIE_SECURE: bool | None = None  # None = secure outside development

    # Local (password) sign-in:
    #   all              - any account with a password (development / pre-Entra)
    #   break_glass_only - only accounts listed in BREAK_GLASS_EMAILS
    #   disabled         - Entra only
    # None = "all" until Entra is configured, then "break_glass_only".
    LOCAL_AUTH_MODE: str | None = None
    BREAK_GLASS_EMAILS: List[str] = []

    # Microsoft Entra ID (external configuration; see docs/entra-setup.md)
    ENTRA_TENANT_ID: str | None = None          # home tenant (GUID)
    ENTRA_ALLOWED_TENANT_IDS: List[str] = []    # defaults to [ENTRA_TENANT_ID]
    ENTRA_SPA_CLIENT_ID: str | None = None      # SPA app registration (public client)
    ENTRA_API_CLIENT_ID: str | None = None      # API app registration
    ENTRA_API_AUDIENCE: str | None = None       # default: api://<ENTRA_API_CLIENT_ID>
    ENTRA_API_SCOPE: str = "access_as_user"     # delegated scope the SPA requests
    ENTRA_ADMIN_APP_ROLE: str = "ERP.Admin"     # app role required for ERP administration
    ENTRA_LINK_BY_EMAIL: bool = True            # link first sign-in to an unlinked employee
    ENTRA_AUTO_PROVISION: bool = False          # create employees on first sign-in

    # Microsoft Graph (application permissions) for the Entra app-role connector
    GRAPH_CLIENT_ID: str | None = None
    GRAPH_CLIENT_SECRET_REF: str = "GRAPH_CLIENT_SECRET"  # name of the secret, not the value

    # Provisioning worker
    PROVISIONING_WORKER_ENABLED: bool = True
    PROVISIONING_POLL_SECONDS: int = 10
    PROVISIONING_MAX_ATTEMPTS: int = 5
    CONNECTOR_TIMEOUT_SECONDS: float = 15.0

    @property
    def entra_enabled(self) -> bool:
        return bool(self.ENTRA_TENANT_ID and self.ENTRA_API_CLIENT_ID and self.ENTRA_SPA_CLIENT_ID)

    @property
    def entra_audience(self) -> str | None:
        if self.ENTRA_API_AUDIENCE:
            return self.ENTRA_API_AUDIENCE
        return f"api://{self.ENTRA_API_CLIENT_ID}" if self.ENTRA_API_CLIENT_ID else None

    @property
    def entra_allowed_tenants(self) -> list[str]:
        tenants = self.ENTRA_ALLOWED_TENANT_IDS or ([self.ENTRA_TENANT_ID] if self.ENTRA_TENANT_ID else [])
        return [t.lower() for t in tenants]

    @property
    def local_auth_mode(self) -> str:
        if self.LOCAL_AUTH_MODE in ("all", "break_glass_only", "disabled"):
            return self.LOCAL_AUTH_MODE
        return "break_glass_only" if self.entra_enabled else "all"

    @property
    def refresh_cookie_secure(self) -> bool:
        if self.REFRESH_COOKIE_SECURE is not None:
            return self.REFRESH_COOKIE_SECURE
        return self.APP_ENV.lower() != "development"

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def api_docs_enabled(self) -> bool:
        if self.ENABLE_API_DOCS is not None:
            return self.ENABLE_API_DOCS
        return not self.is_production

    @property
    def seed_on_startup(self) -> bool:
        if self.SEED_ON_STARTUP is not None:
            return self.SEED_ON_STARTUP
        return not self.is_production

    @model_validator(mode="after")
    def _harden(self) -> "Settings":
        for name in ("JWT_SECRET_KEY", "SECRET_KEY"):
            value = getattr(self, name)
            insecure = value.strip().lower() in INSECURE_SECRETS or len(value) < MIN_SECRET_LENGTH
            if not insecure:
                continue
            if self.is_production:
                raise ValueError(
                    f"{name} must be set to a random value of at least "
                    f"{MIN_SECRET_LENGTH} characters in production"
                )
            if value.strip().lower() in INSECURE_SECRETS:
                # Dev only: use an ephemeral random key so tokens can never be forged
                # with a value published in source. Sessions reset on restart.
                logger.warning("%s is not set; using an ephemeral random key", name)
                setattr(self, name, secrets.token_urlsafe(64))
            else:
                logger.warning("%s is shorter than %d characters", name, MIN_SECRET_LENGTH)

        if "*" in self.CORS_ORIGINS:
            logger.warning("Ignoring '*' in CORS_ORIGINS; list explicit origins instead")
            self.CORS_ORIGINS = [o for o in self.CORS_ORIGINS if o != "*"]
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()
