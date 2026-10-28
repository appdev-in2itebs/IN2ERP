"""Access-control platform: session security, Entra identity, app role catalogue,
multi-role assignments with provisioning state, outbox, refresh tokens, audit integrity

Revision ID: 0002_access_platform
Revises: 0001_baseline
Create Date: 2026-10-27

Schema
- users: token_version, must_change_password, lockout fields, entra_tenant_id
- applications: auth_method, integration_type/status, connector config + secret reference
- app_roles: per-application role catalogue (external id, source, sync status)
- app_assignments: one row per user/app/role (unique constraint replaced), app_role_id,
  provisioning_status, version, last_error/verified, revoked_at/by
- provisioning_jobs: transactional outbox
- refresh_tokens: rotation and replay detection
- audit_logs: correlation_id; UPDATE/DELETE blocked by triggers (append-only)

Data (existing rows are preserved)
- Each application's catalogue is built from the role names already assigned plus a
  starting catalogue for known applications, and every assignment is linked to it.
- Existing active assignments become `manual_action_required`: they were recorded but
  never confirmed in the target application.
- The Manager role loses `assignments.create`: only ERP administrators grant access.
- Accounts with a password must choose a new one at next sign-in (shared defaults were used).
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_access_platform"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Frozen copy of the starting catalogue: (name, code, is_default).
_CRM = [
    ("Administrator", "ADMIN", False), ("Chief Revenue Officer", "CRO", False),
    ("Sales Manager", "SALES_MANAGER", False), ("Salesperson", "SALES", False),
    ("Practice Lead", "PRACTICE_LEAD", False), ("Finance Approver", "FINANCE", False),
    ("Executive Chairman", "EXEC_CHAIRMAN", False), ("Project Manager", "PROJECT_MANAGER", False),
    ("Read Only", "VIEWER", True),
]
STARTING_CATALOGUE = {
    "hr-management": [("HR Director", "HR_DIRECTOR", False), ("HR Manager", "HR_MANAGER", False),
                      ("HR Staff", "HR_STAFF", False), ("Employee Self-Service", "ESS", True)],
    "finance": [("Finance Controller", "CONTROLLER", False), ("Accountant", "ACCOUNTANT", False),
                ("Approver", "APPROVER", False), ("Viewer", "VIEWER", True)],
    "project-mgmt": [("Project Lead", "LEAD", False), ("Senior Developer", "SENIOR_DEV", False),
                     ("Contributor", "CONTRIBUTOR", True), ("Viewer", "VIEWER", False)],
    "inventory": [("Inventory Manager", "MANAGER", False), ("Store Keeper", "STORE_KEEPER", False),
                  ("Viewer", "VIEWER", True)],
    "crm": _CRM,
    "in2crm": _CRM,
    "payroll": [("Payroll Administrator", "ADMIN", False), ("Payroll Processor", "PROCESSOR", False),
                ("Viewer", "VIEWER", True)],
    "leave-mgmt": [("Leave Approver / HOD", "APPROVER", False),
                   ("Staff / Requester", "REQUESTER", True)],
    "reports": [("Analyst", "ANALYST", False), ("Viewer", "VIEWER", True)],
}


def _ts(name: str, nullable: bool = True) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def upgrade() -> None:
    # ── users ──
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False,
                                     server_default=sa.false()))
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False,
                                     server_default="0"))
    op.add_column("users", _ts("locked_until"))
    op.add_column("users", _ts("password_changed_at"))
    op.add_column("users", sa.Column("entra_tenant_id", sa.String(64), nullable=True))

    # ── applications ──
    op.add_column("applications", sa.Column("auth_method", sa.String(30), nullable=False,
                                            server_default="entra_sso"))
    op.add_column("applications", sa.Column("integration_type", sa.String(30), nullable=False,
                                            server_default="manual"))
    op.add_column("applications", sa.Column("integration_status", sa.String(20), nullable=False,
                                            server_default="manual"))
    op.add_column("applications", sa.Column("connector_config", sa.Text(), nullable=True))
    op.add_column("applications", sa.Column("connector_secret_ref", sa.String(255), nullable=True))
    op.add_column("applications", _ts("last_connection_test_at"))
    op.add_column("applications", sa.Column("last_connection_error", sa.Text(), nullable=True))

    # ── app_roles ──
    op.create_table(
        "app_roles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("application_id", sa.String(36),
                  sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("external_role_id", sa.String(255), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="unverified"),
        _ts("synced_at"),
        _ts("created_at", False),
        sa.UniqueConstraint("application_id", "name", name="uq_app_role_name"),
    )
    op.create_index("ix_app_roles_application_id", "app_roles", ["application_id"])

    # ── app_assignments ──
    # Databases patched by the old add_column.py script have a nullable app_role.
    op.execute("UPDATE app_assignments SET app_role = 'Member' WHERE app_role IS NULL")
    with op.batch_alter_table("app_assignments") as batch:
        batch.drop_constraint("uq_user_app", type_="unique")
        batch.alter_column("app_role", existing_type=sa.String(50), type_=sa.String(100),
                           nullable=False, existing_server_default="Member")
        batch.add_column(sa.Column("app_role_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("provisioning_status", sa.String(30), nullable=False,
                                   server_default="pending"))
        batch.add_column(sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
        batch.add_column(sa.Column("last_error", sa.Text(), nullable=True))
        batch.add_column(_ts("last_verified_at"))
        batch.add_column(_ts("revoked_at"))
        batch.add_column(sa.Column("revoked_by", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_app_assignments_app_role_id", "app_roles",
                                 ["app_role_id"], ["id"], ondelete="SET NULL")
        batch.create_unique_constraint("uq_user_app_role", ["user_id", "application_id", "app_role_id"])
        batch.create_index("ix_app_assignments_user_id", ["user_id"])
        batch.create_index("ix_app_assignments_application_id", ["application_id"])

    # ── provisioning_jobs (outbox) ──
    op.create_table(
        "provisioning_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("assignment_id", sa.String(36),
                  sa.ForeignKey("app_assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("application_id", sa.String(36), nullable=False),
        sa.Column("operation", sa.String(20), nullable=False),
        sa.Column("assignment_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        _ts("next_attempt_at", False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(80), nullable=False, unique=True),
        sa.Column("correlation_id", sa.String(64), nullable=True),
        sa.Column("requested_by", sa.String(36), nullable=True),
        _ts("created_at", False),
        _ts("updated_at", False),
        _ts("completed_at"),
    )
    op.create_index("ix_provisioning_jobs_assignment_id", "provisioning_jobs", ["assignment_id"])
    op.create_index("ix_provisioning_jobs_application_id", "provisioning_jobs", ["application_id"])
    op.create_index("ix_provisioning_jobs_status", "provisioning_jobs", ["status"])

    # ── refresh_tokens ──
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("family_id", sa.String(64), nullable=False),
        _ts("issued_at", False),
        _ts("expires_at", False),
        _ts("used_at"),
        _ts("revoked_at"),
        sa.Column("replaced_by", sa.String(64), nullable=True),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])

    # ── audit_logs ──
    op.add_column("audit_logs", sa.Column("correlation_id", sa.String(64), nullable=True))
    op.create_index("ix_audit_logs_correlation_id", "audit_logs", ["correlation_id"])
    _create_audit_triggers()

    # ── data ──
    _backfill_catalogue()
    op.execute(
        "UPDATE app_assignments SET provisioning_status = 'manual_action_required' "
        "WHERE status = 'active'"
    )
    op.execute(
        "UPDATE app_assignments SET status = 'revoked', provisioning_status = 'revoked' "
        "WHERE status <> 'active'"
    )
    op.execute(
        "DELETE FROM role_permissions WHERE "
        "role_id IN (SELECT id FROM roles WHERE name = 'Manager') AND "
        "permission_id IN (SELECT id FROM permissions WHERE code = 'assignments.create')"
    )
    op.execute(sa.text(
        "UPDATE users SET must_change_password = :t WHERE hashed_password IS NOT NULL"
    ).bindparams(t=True))
    _invalidate_shared_passwords()


# Publicly known default passwords previously shipped in this repository's seed scripts,
# README and UI. Accounts still using one can no longer sign in with it.
KNOWN_SHARED_PASSWORDS = ("admin123", "employee123", "password123")


def _invalidate_shared_passwords() -> None:
    """Clear passwords that match a published default. Recovery: an administrator issues a
    one-time password in the Admin Console, or an operator runs `python -m app.cli set-password`."""
    if context.is_offline_mode():
        op.execute("-- shared-password check runs only in online mode (it reads password hashes)")
        return
    import bcrypt

    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, hashed_password FROM users WHERE hashed_password IS NOT NULL")
    ).fetchall()
    for user_id, hashed in rows:
        try:
            matches = any(
                bcrypt.checkpw(p.encode(), hashed.encode()) for p in KNOWN_SHARED_PASSWORDS
            )
        except ValueError:
            continue  # not a bcrypt hash; leave it for the forced password change
        if matches:
            bind.execute(
                sa.text("UPDATE users SET hashed_password = NULL, must_change_password = :f "
                        "WHERE id = :id"),
                {"id": user_id, "f": False},
            )


def _create_audit_triggers() -> None:
    dialect = op.get_context().dialect.name
    if dialect == "sqlite":
        for event in ("UPDATE", "DELETE"):
            op.execute(
                f"CREATE TRIGGER audit_logs_no_{event.lower()} BEFORE {event} ON audit_logs "
                "BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;"
            )
    elif dialect == "postgresql":
        op.execute(
            "CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$ "
            "BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$ LANGUAGE plpgsql"
        )
        op.execute(
            "CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs "
            "FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()"
        )


def _drop_audit_triggers() -> None:
    dialect = op.get_context().dialect.name
    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS audit_logs_no_update")
        op.execute("DROP TRIGGER IF EXISTS audit_logs_no_delete")
    elif dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs")
        op.execute("DROP FUNCTION IF EXISTS audit_logs_append_only()")


def _backfill_catalogue() -> None:
    if context.is_offline_mode():
        op.execute("-- app_roles backfill runs only in online mode (it reads existing rows)")
        return
    bind = op.get_bind()
    now = datetime.now(timezone.utc)
    apps = bind.execute(sa.text("SELECT id, slug FROM applications")).fetchall()
    app_roles = sa.table(
        "app_roles",
        sa.column("id"), sa.column("application_id"), sa.column("name"), sa.column("code"),
        sa.column("is_default"), sa.column("sort_order"), sa.column("created_at"),
    )

    for app_id, slug in apps:
        rows: dict[str, dict] = {}
        for order, (name, code, is_default) in enumerate(STARTING_CATALOGUE.get(slug, [])):
            rows[name.lower()] = {"name": name, "code": code, "is_default": is_default,
                                  "sort_order": order}
        # Every role name already assigned becomes part of the catalogue.
        in_use = bind.execute(
            sa.text("SELECT DISTINCT app_role FROM app_assignments "
                    "WHERE application_id = :a AND app_role IS NOT NULL"),
            {"a": app_id},
        ).scalars().all()
        for name in in_use:
            if name.strip() and name.strip().lower() not in rows:
                rows[name.strip().lower()] = {"name": name.strip(), "code": None,
                                              "is_default": False, "sort_order": 100 + len(rows)}
        if not rows:
            continue

        for row in rows.values():
            row.update(id=str(uuid.uuid4()), application_id=app_id, created_at=now)
        op.bulk_insert(app_roles, list(rows.values()))

        for row in rows.values():
            bind.execute(
                sa.text("UPDATE app_assignments SET app_role_id = :rid, app_role = :name "
                        "WHERE application_id = :a AND lower(trim(app_role)) = :lname"),
                {"rid": row["id"], "name": row["name"], "a": app_id, "lname": row["name"].lower()},
            )


def downgrade() -> None:
    _drop_audit_triggers()
    op.drop_index("ix_audit_logs_correlation_id", table_name="audit_logs")
    with op.batch_alter_table("audit_logs") as batch:
        batch.drop_column("correlation_id")

    op.drop_index("ix_refresh_tokens_family_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("provisioning_jobs")

    # Collapse to one row per user and application before restoring the old constraint.
    op.execute(
        "DELETE FROM app_assignments WHERE id NOT IN ("
        "SELECT MIN(id) FROM app_assignments GROUP BY user_id, application_id)"
    )
    with op.batch_alter_table("app_assignments") as batch:
        batch.drop_index("ix_app_assignments_application_id")
        batch.drop_index("ix_app_assignments_user_id")
        batch.drop_constraint("uq_user_app_role", type_="unique")
        batch.drop_constraint("fk_app_assignments_app_role_id", type_="foreignkey")
        for col in ("revoked_by", "revoked_at", "last_verified_at", "last_error", "version",
                    "provisioning_status", "app_role_id"):
            batch.drop_column(col)
        batch.alter_column("app_role", existing_type=sa.String(100), type_=sa.String(50))
        batch.create_unique_constraint("uq_user_app", ["user_id", "application_id"])

    op.drop_index("ix_app_roles_application_id", table_name="app_roles")
    op.drop_table("app_roles")
    with op.batch_alter_table("applications") as batch:
        for col in ("last_connection_error", "last_connection_test_at", "connector_secret_ref",
                    "connector_config", "integration_status", "integration_type", "auth_method"):
            batch.drop_column(col)
    with op.batch_alter_table("users") as batch:
        for col in ("entra_tenant_id", "password_changed_at", "locked_until",
                    "failed_login_attempts", "must_change_password", "token_version"):
            batch.drop_column(col)
