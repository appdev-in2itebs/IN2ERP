"""
In2IT ERP - Provisioning service

Delivers access changes to target applications through a transactional outbox:

1. An access change updates the assignment (bumping its `version`) and inserts a
   ProvisioningJob in the same transaction (`enqueue`).
2. The worker claims due jobs, calls the application's connector, reads the result back
   from the target (`verify`), and records the observed state and an audit entry.
3. A job created for an older assignment version is marked `superseded` instead of run,
   so a stale grant can never restore access that was revoked later.
4. Transient connector failures are retried with exponential backoff; permanent ones fail
   immediately with the error shown to administrators.

Applications with `integration_type = "manual"` get no jobs: an app owner applies the
change and confirms it (see AccessService.confirm_manual).
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.request_context import correlation_id_var
from app.integrations.base import (
    ConnectorError, ConnectorNotConfigured, ManualActionRequired, Subject,
)
from app.integrations.registry import build_connector, http_client
from app.models.application import AppAssignment, Application
from app.models.provisioning import ProvisioningJob
from app.services.audit_service import record_audit

logger = logging.getLogger("in2erp.provisioning")

GRANT, REVOKE, VERIFY = "grant", "revoke", "verify"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def pending_status(app: Application, operation: str) -> str:
    """Provisioning status to show while a change is on its way to the target."""
    if app.integration_type == "manual":
        return "manual_action_required"
    return "revocation_pending" if operation == REVOKE else "pending"


async def enqueue(
    db: AsyncSession, assignment: AppAssignment, operation: str, requested_by: str | None
) -> ProvisioningJob | None:
    """Queue a connector job for the assignment's current version (same transaction)."""
    if assignment.application.integration_type == "manual":
        return None
    job = ProvisioningJob(
        assignment_id=assignment.id,
        application_id=assignment.application_id,
        operation=operation,
        assignment_version=assignment.version,
        max_attempts=get_settings().PROVISIONING_MAX_ATTEMPTS,
        idempotency_key=f"{assignment.id}:v{assignment.version}:{operation}:{uuid.uuid4().hex[:12]}",
        correlation_id=correlation_id_var.get(),
        requested_by=requested_by,
        next_attempt_at=_utcnow(),
    )
    db.add(job)
    await db.flush()
    return job


def _backoff(attempts: int) -> timedelta:
    return timedelta(seconds=min(15 * (2 ** max(attempts - 1, 0)), 3600))


async def _claim_due_jobs(session_factory: async_sessionmaker, limit: int) -> list[str]:
    """Mark due jobs as running. At most one job per assignment runs at a time, oldest first."""
    async with session_factory() as db:
        running = set((await db.execute(
            select(ProvisioningJob.assignment_id).where(ProvisioningJob.status == "running")
        )).scalars())
        due = (await db.execute(
            select(ProvisioningJob)
            .where(ProvisioningJob.status == "queued", ProvisioningJob.next_attempt_at <= _utcnow())
            .order_by(ProvisioningJob.created_at)
            .limit(limit * 4)
        )).scalars().all()

        claimed: list[str] = []
        for job in due:
            if job.assignment_id in running or len(claimed) >= limit:
                continue
            running.add(job.assignment_id)
            job.status = "running"
            job.attempts += 1
            claimed.append(job.id)
        await db.commit()
        return claimed


async def run_job(session_factory: async_sessionmaker, job_id: str) -> str:
    """Execute one claimed job. Returns the job's final status for this attempt."""
    async with session_factory() as db:
        job = (await db.execute(
            select(ProvisioningJob)
            .options(
                selectinload(ProvisioningJob.assignment).selectinload(AppAssignment.application),
                selectinload(ProvisioningJob.assignment).selectinload(AppAssignment.user),
                selectinload(ProvisioningJob.assignment).selectinload(AppAssignment.role),
            )
            .where(ProvisioningJob.id == job_id)
        )).scalar_one()
        assignment = job.assignment
        now = _utcnow()

        if job.assignment_version != assignment.version:
            job.status, job.completed_at = "superseded", now
            await db.commit()
            return job.status

        token = correlation_id_var.set(job.correlation_id)
        new_status: str | None = None
        error: str | None = None
        try:
            new_status = await _execute(job, assignment)
            job.status = "succeeded"
        except ManualActionRequired as exc:
            new_status, job.status, error = "manual_action_required", "manual", str(exc)
        except ConnectorNotConfigured as exc:
            new_status, job.status, error = "failed", "failed", str(exc)
        except ConnectorError as exc:
            error = str(exc)
            if exc.transient and job.attempts < job.max_attempts:
                job.status = "queued"
                job.next_attempt_at = now + _backoff(job.attempts)
            else:
                new_status, job.status = "failed", "failed"
        except Exception as exc:  # unexpected: retry like a transient failure, but log it
            logger.exception("Provisioning job %s crashed", job.id)
            error = f"Unexpected error: {exc.__class__.__name__}"
            if job.attempts < job.max_attempts:
                job.status, job.next_attempt_at = "queued", now + _backoff(job.attempts)
            else:
                new_status, job.status = "failed", "failed"
        finally:
            correlation_id_var.reset(token)

        job.last_error = error
        if job.status != "queued":
            job.completed_at = _utcnow()

        # Another change may have landed while the connector call was in flight.
        await db.refresh(assignment, ["version"])
        if assignment.version != job.assignment_version:
            job.status = "superseded"
        elif new_status:
            assignment.provisioning_status = new_status
            assignment.last_error = error
            if new_status == "verified":
                assignment.last_verified_at = _utcnow()
        elif error:
            assignment.last_error = f"{error} (retrying)"

        await record_audit(
            db, action="provisioning_attempt", resource_type="assignment",
            resource_id=assignment.id, actor_email="system:provisioning",
            status="success" if job.status in ("succeeded", "manual", "superseded") else "failure",
            details={
                "job_id": job.id, "operation": job.operation, "attempt": job.attempts,
                "job_status": job.status, "provisioning_status": assignment.provisioning_status,
                "application": assignment.application.name, "user_email": assignment.user.email,
                "app_role": assignment.app_role, "error": error,
            },
        )
        await db.commit()
        return job.status


async def _execute(job: ProvisioningJob, assignment: AppAssignment) -> str:
    """Run the connector call and read back the result. Returns the observed status."""
    role = assignment.role
    if not role or not role.external_role_id:
        raise ConnectorNotConfigured(
            f"Role '{assignment.app_role}' has no external role ID. Sync the role catalogue."
        )
    subject = Subject(
        user_id=assignment.user_id,
        email=assignment.user.email,
        entra_object_id=assignment.user.entra_id,
    )
    async with http_client() as client:
        connector = build_connector(assignment.application, client)
        ext = role.external_role_id
        if job.operation == GRANT:
            await connector.grant(subject, ext, job.idempotency_key)
            confirmed = await connector.verify(subject, ext, expect_present=True)
            return "verified" if confirmed else "reconciliation_required"
        if job.operation == REVOKE:
            await connector.revoke(subject, ext, job.idempotency_key)
            confirmed = await connector.verify(subject, ext, expect_present=False)
            return "revoked" if confirmed else "reconciliation_required"
        expect = assignment.is_effective()
        confirmed = await connector.verify(subject, ext, expect_present=expect)
        if not confirmed:
            return "reconciliation_required"
        return "verified" if expect else "revoked"


async def process_due_jobs(
    session_factory: async_sessionmaker, limit: int = 20, max_rounds: int = 10
) -> dict:
    """
    Run due jobs until none are left (bounded). Jobs for the same assignment run one
    after another, so a superseded job is followed by the newer job in the same pass.
    Returns a count per resulting job status.
    """
    results: dict[str, int] = {}
    for _ in range(max_rounds):
        claimed = await _claim_due_jobs(session_factory, limit)
        if not claimed:
            break
        for job_id in claimed:
            status = await run_job(session_factory, job_id)
            results[status] = results.get(status, 0) + 1
    return results


async def expire_assignments(session_factory: async_sessionmaker) -> int:
    """Turn assignments past their expiry into revocations in the target application."""
    async with session_factory() as db:
        now = _utcnow()
        expired = (await db.execute(
            select(AppAssignment)
            .options(selectinload(AppAssignment.application), selectinload(AppAssignment.user))
            .where(
                AppAssignment.status == "active",
                AppAssignment.expires_at.is_not(None),
                AppAssignment.expires_at <= now,
            )
        )).scalars().all()

        for assignment in expired:
            assignment.status = "expired"
            assignment.version += 1
            assignment.provisioning_status = pending_status(assignment.application, REVOKE)
            await enqueue(db, assignment, REVOKE, requested_by=None)
            await record_audit(
                db, action="expire_app_access", resource_type="assignment",
                resource_id=assignment.id, actor_email="system:expiry",
                details={
                    "user_email": assignment.user.email,
                    "application": assignment.application.name,
                    "app_role": assignment.app_role,
                    "expired_at": assignment.expires_at,
                },
            )
        await db.commit()
        return len(expired)


async def run_worker(session_factory: async_sessionmaker, interval: float) -> None:
    """Background loop: expiry sweep, then deliver due jobs."""
    logger.info("Provisioning worker started (every %ss)", interval)
    while True:
        try:
            await expire_assignments(session_factory)
            await process_due_jobs(session_factory)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Provisioning worker cycle failed")
        await asyncio.sleep(interval)
