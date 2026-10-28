"""
In2IT ERP - Application, App Role & Assignment Models
Registered business applications, the roles each application defines,
and the application roles each employee has been granted.

The ERP is the control plane: an assignment records intended access and its
provisioning state. Each application remains the enforcement point for its roles.
"""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

# How access changes reach the target application.
#   manual          - an app owner applies changes in the target app and confirms them in the ERP
#   entra_app_roles - Microsoft Entra app-role assignments through Microsoft Graph
#   scim            - SCIM 2.0 group membership in the target application
#   custom_api      - the In2ERP provisioning API contract implemented by the application
INTEGRATION_TYPES = ("manual", "entra_app_roles", "scim", "custom_api")

# Connector health as last observed by the ERP (manual = no connector by design).
INTEGRATION_STATUSES = ("manual", "unconfigured", "configured", "healthy", "error")

# How employees sign in to the application itself.
AUTH_METHODS = ("entra_sso", "oidc", "saml", "local", "other")

# Assignment lifecycle in the ERP (the intent).
ASSIGNMENT_STATUSES = ("active", "revoked", "expired")

# Whether the target application reflects the intent.
PROVISIONING_STATUSES = (
    "pending",                  # grant queued for the connector
    "applied",                  # connector reported success; verification outstanding
    "verified",                 # target system confirmed the role is held
    "failed",                   # connector gave up; see last_error
    "revocation_pending",       # revoke queued for the connector
    "revoked",                  # target system confirmed the role is removed
    "reconciliation_required",  # ERP and target disagree, or state unknown
    "manual_action_required",   # no connector: an app owner must apply and confirm
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class Application(Base):
    """A business application whose access is governed by the ERP."""
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Icon name/class
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # Hex color
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # Launch URL
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_core: Mapped[bool] = mapped_column(Boolean, default=False)  # Core system module
    requires_license: Mapped[bool] = mapped_column(Boolean, default=False)
    max_users: Mapped[int | None] = mapped_column(nullable=True)  # None = unlimited
    sort_order: Mapped[int] = mapped_column(default=0)

    auth_method: Mapped[str] = mapped_column(
        String(30), default="entra_sso", server_default="entra_sso"
    )
    integration_type: Mapped[str] = mapped_column(
        String(30), default="manual", server_default="manual"
    )
    integration_status: Mapped[str] = mapped_column(
        String(20), default="unconfigured", server_default="unconfigured"
    )
    # Non-secret connector settings as JSON (base URL, service principal id, ...)
    connector_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Name of the secret holding the connector credential (env var / Key Vault reference)
    connector_secret_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_connection_test_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_connection_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    # Relationships
    assignments: Mapped[list["AppAssignment"]] = relationship(
        "AppAssignment", back_populates="application", cascade="all, delete-orphan"
    )
    roles: Mapped[list["AppRole"]] = relationship(
        "AppRole",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="AppRole.sort_order, AppRole.name",
    )

    @property
    def config(self) -> dict:
        try:
            return json.loads(self.connector_config) if self.connector_config else {}
        except ValueError:
            return {}

    def __repr__(self) -> str:
        return f"<Application {self.name}>"


class AppRole(Base):
    """
    A role defined by an application (e.g. In2CRM "Sales Manager").
    It mirrors the target application's own role; it is not an ERP platform role.
    """
    __tablename__ = "app_roles"
    __table_args__ = (
        UniqueConstraint("application_id", "name", name="uq_app_role_name"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    application_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Identifier of the role in the target system (Entra app role id, SCIM group id, ...)
    external_role_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    # manual = entered by an admin; connector = retrieved from the target application
    source: Mapped[str] = mapped_column(String(20), default="manual", server_default="manual")
    # unverified = not yet confirmed by the target; verified; missing = no longer in the target
    sync_status: Mapped[str] = mapped_column(
        String(20), default="unverified", server_default="unverified"
    )
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    application: Mapped["Application"] = relationship("Application", back_populates="roles")

    def __repr__(self) -> str:
        return f"<AppRole {self.name}>"


class AppAssignment(Base):
    """One application role granted to one employee."""
    __tablename__ = "app_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "application_id", "app_role_id", name="uq_user_app_role"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    application_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    app_role_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("app_roles.id", ondelete="SET NULL"), nullable=True
    )
    # Role name snapshot, kept for display and history even if the catalogue changes
    app_role: Mapped[str] = mapped_column(
        String(100), default="Member", server_default="Member"
    )
    status: Mapped[str] = mapped_column(String(20), default="active")
    provisioning_status: Mapped[str] = mapped_column(
        String(30), default="pending", server_default="pending"
    )
    # Incremented on every change of intent; jobs carry the version they were queued for
    # so a stale job can never restore an older state.
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    assigned_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="app_assignments")
    application: Mapped["Application"] = relationship("Application", back_populates="assignments")
    role: Mapped["AppRole | None"] = relationship("AppRole")

    @property
    def application_slug(self) -> str:
        return self.application.slug if self.application else ""

    @property
    def application_name(self) -> str:
        return self.application.name if self.application else ""

    def is_expired(self, now: datetime | None = None) -> bool:
        return self.expires_at is not None and _aware(self.expires_at) <= (now or _utcnow())

    def is_effective(self, now: datetime | None = None) -> bool:
        """True when the ERP intends this role to be held (active and not expired)."""
        return self.status == "active" and not self.is_expired(now)

    def is_launchable(self, now: datetime | None = None) -> bool:
        """True when the intent is effective and the target system has confirmed it."""
        return self.is_effective(now) and self.provisioning_status == "verified"
