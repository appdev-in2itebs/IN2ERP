"""
In2IT ERP - Application & Assignment Models
Internal ERP modules/applications and their user assignments.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Application(Base):
    """An internal ERP business module/application."""
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Icon name/class
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # Hex color
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # Internal route or URL
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_core: Mapped[bool] = mapped_column(Boolean, default=False)  # Core system module
    requires_license: Mapped[bool] = mapped_column(Boolean, default=False)
    max_users: Mapped[int | None] = mapped_column(nullable=True)  # None = unlimited
    sort_order: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    assignments: Mapped[list["AppAssignment"]] = relationship(
        "AppAssignment", back_populates="application", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Application {self.name}>"


class AppAssignment(Base):
    """Assignment of an application/module to a user."""
    __tablename__ = "app_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "application_id", name="uq_user_app"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    application_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    app_role: Mapped[str] = mapped_column(
        String(50), default="Member", server_default="Member"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="active"  # active, suspended, pending
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    assigned_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="app_assignments")
    application: Mapped["Application"] = relationship("Application", back_populates="assignments")

    @property
    def application_slug(self) -> str:
        return self.application.slug if self.application else ""

    @property
    def application_name(self) -> str:
        return self.application.name if self.application else ""
