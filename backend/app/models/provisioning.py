"""
In2IT ERP - Provisioning Outbox Model
Each change of access intent writes a job in the same transaction as the change.
A worker delivers jobs to the application's connector.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

JOB_OPERATIONS = ("grant", "revoke", "verify")
JOB_STATUSES = ("queued", "running", "succeeded", "failed", "superseded", "manual")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProvisioningJob(Base):
    __tablename__ = "provisioning_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    assignment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("app_assignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    application_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(20), nullable=False)
    # Assignment version this job was created for (see AppAssignment.version)
    assignment_version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Stable key passed to connectors so a retried call cannot create a duplicate grant
    idempotency_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    requested_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    assignment: Mapped["AppAssignment"] = relationship("AppAssignment")
