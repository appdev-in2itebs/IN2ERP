"""
In2IT ERP - User Model
Core user entity with support for local auth and future Entra ID integration.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)

    # Entra ID fields (future)
    entra_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    role_assignments: Mapped[list["UserRole"]] = relationship(
        "UserRole", back_populates="user", cascade="all, delete-orphan"
    )
    permission_overrides: Mapped[list["UserPermissionOverride"]] = relationship(
        "UserPermissionOverride", back_populates="user", cascade="all, delete-orphan"
    )
    app_assignments: Mapped[list["AppAssignment"]] = relationship(
        "AppAssignment", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def primary_role(self) -> str:
        if self.is_superadmin:
            return "Super Administrator"
        if self.role_assignments and len(self.role_assignments) > 0:
            assigned = self.role_assignments[0]
            if hasattr(assigned, "role") and assigned.role:
                return assigned.role.name
        return "Employee"

    @property
    def role_names(self) -> list[str]:
        if self.is_superadmin:
            return ["Super Administrator"]
        if not self.role_assignments:
            return ["Employee"]
        names = [ra.role.name for ra in self.role_assignments if hasattr(ra, "role") and ra.role]
        return names if names else ["Employee"]

    def __repr__(self) -> str:
        return f"<User {self.email}>"
