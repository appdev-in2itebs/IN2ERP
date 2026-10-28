"""Baseline schema (as created by create_all before Alembic was adopted)

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-27

Databases created before Alembic already contain these tables, so every table is
created only when missing. This lets `alembic upgrade head` run unchanged on both
fresh and existing databases.
"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts(name: str, nullable: bool = True) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def upgrade() -> None:
    # Offline (--sql) generation cannot inspect a database; assume it is empty.
    existing = set() if context.is_offline_mode() else set(
        sa.inspect(op.get_bind()).get_table_names()
    )

    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("hashed_password", sa.String(255), nullable=True),
            sa.Column("first_name", sa.String(100), nullable=False),
            sa.Column("last_name", sa.String(100), nullable=False),
            sa.Column("avatar_url", sa.String(500), nullable=True),
            sa.Column("phone", sa.String(20), nullable=True),
            sa.Column("department", sa.String(100), nullable=True),
            sa.Column("designation", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("is_superadmin", sa.Boolean(), nullable=False),
            sa.Column("entra_id", sa.String(255), nullable=True, unique=True),
            _ts("created_at", False),
            _ts("updated_at", False),
            _ts("last_login_at"),
        )
        op.create_index("ix_users_email", "users", ["email"], unique=True)

    if "roles" not in existing:
        op.create_table(
            "roles",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(100), nullable=False, unique=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_system", sa.Boolean(), nullable=False),
            sa.Column("color", sa.String(7), nullable=True),
            _ts("created_at", False),
            _ts("updated_at", False),
        )

    if "permissions" not in existing:
        op.create_table(
            "permissions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("code", sa.String(100), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("module", sa.String(50), nullable=False),
            _ts("created_at", False),
        )
        op.create_index("ix_permissions_code", "permissions", ["code"], unique=True)
        op.create_index("ix_permissions_module", "permissions", ["module"])

    if "role_permissions" not in existing:
        op.create_table(
            "role_permissions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("role_id", sa.String(36),
                      sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("permission_id", sa.String(36),
                      sa.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False),
            sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
        )

    if "user_roles" not in existing:
        op.create_table(
            "user_roles",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("role_id", sa.String(36),
                      sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
            _ts("assigned_at", False),
            sa.Column("assigned_by", sa.String(36), nullable=True),
            sa.UniqueConstraint("user_id", "role_id", name="uq_user_role"),
        )

    if "user_permission_overrides" not in existing:
        op.create_table(
            "user_permission_overrides",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("permission_id", sa.String(36),
                      sa.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("is_granted", sa.Boolean(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            _ts("granted_at", False),
            sa.Column("granted_by", sa.String(36), nullable=True),
            sa.UniqueConstraint("user_id", "permission_id", name="uq_user_permission_override"),
        )

    if "applications" not in existing:
        op.create_table(
            "applications",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(200), nullable=False, unique=True),
            sa.Column("slug", sa.String(100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("icon", sa.String(50), nullable=True),
            sa.Column("color", sa.String(7), nullable=True),
            sa.Column("url", sa.String(500), nullable=True),
            sa.Column("category", sa.String(50), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("is_core", sa.Boolean(), nullable=False),
            sa.Column("requires_license", sa.Boolean(), nullable=False),
            sa.Column("max_users", sa.Integer(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            _ts("created_at", False),
            _ts("updated_at", False),
        )
        op.create_index("ix_applications_slug", "applications", ["slug"], unique=True)

    if "app_assignments" not in existing:
        op.create_table(
            "app_assignments",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("application_id", sa.String(36),
                      sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("app_role", sa.String(50), nullable=False, server_default="Member"),
            sa.Column("status", sa.String(20), nullable=False),
            _ts("assigned_at", False),
            sa.Column("assigned_by", sa.String(36), nullable=True),
            _ts("expires_at"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.UniqueConstraint("user_id", "application_id", name="uq_user_app"),
        )

    if "audit_logs" not in existing:
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.String(36), primary_key=True),
            _ts("timestamp", False),
            sa.Column("user_id", sa.String(36), nullable=True),
            sa.Column("user_email", sa.String(255), nullable=True),
            sa.Column("action", sa.String(50), nullable=False),
            sa.Column("resource_type", sa.String(50), nullable=False),
            sa.Column("resource_id", sa.String(36), nullable=True),
            sa.Column("details", sa.Text(), nullable=True),
            sa.Column("ip_address", sa.String(45), nullable=True),
            sa.Column("user_agent", sa.String(500), nullable=True),
            sa.Column("status", sa.String(20), nullable=False),
        )
        op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])
        op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
        op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
        op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])


def downgrade() -> None:
    for table in (
        "audit_logs", "app_assignments", "applications", "user_permission_overrides",
        "user_roles", "role_permissions", "permissions", "roles", "users",
    ):
        op.drop_table(table)
