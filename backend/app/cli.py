"""
In2IT ERP - administrative command line

    python -m app.cli bootstrap-admin --email admin@contoso.com
    python -m app.cli set-password --email admin@contoso.com

bootstrap-admin creates the first superadmin on a database that has none; it refuses
when one exists (further administrators are granted in the Admin Console, audited).
set-password is the break-glass recovery path for operators with server access.
Passwords are read interactively (never from arguments, never printed) and must meet
the password policy.
"""

import argparse
import asyncio
import getpass
import sys
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.security import hash_password, password_policy_errors
from app.db.database import async_session_factory
from app.db.seed import seed_database
# Register every model so SQLAlchemy can resolve relationships outside the web app.
from app.models import application, audit, provisioning, session  # noqa: F401
from app.models.role import Role, UserRole
from app.models.user import User
from app.services.audit_service import record_audit


async def bootstrap_admin(email: str, first_name: str, last_name: str) -> int:
    async with async_session_factory() as db:
        await seed_database(db)  # permissions, roles and applications if the database is empty

    async with async_session_factory() as db:
        existing = (await db.execute(select(User).where(User.is_superadmin.is_(True)))).scalars().first()
        if existing:
            print("A superadmin already exists. Grant further administrators in the Admin Console.")
            return 1
        if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
            print(f"{email} already exists; choose another email.")
            return 1

        password = getpass.getpass("New administrator password: ")
        errors = password_policy_errors(password)
        if errors:
            print("Password " + "; ".join(errors))
            return 1
        if getpass.getpass("Repeat password: ") != password:
            print("Passwords do not match.")
            return 1

        admin = User(
            email=email, first_name=first_name, last_name=last_name,
            hashed_password=hash_password(password), is_active=True, is_superadmin=True,
        )
        db.add(admin)
        await db.flush()
        super_role = (await db.execute(select(Role).where(Role.name == "Super Admin"))).scalar_one()
        db.add(UserRole(user_id=admin.id, role_id=super_role.id))
        await record_audit(
            db, action="bootstrap_admin", resource_type="user", resource_id=admin.id,
            actor_email="system:cli", details={"email": email},
        )
        await db.commit()
    print(f"Superadmin {email} created. Add it to BREAK_GLASS_EMAILS if it is the break-glass account.")
    return 0


async def set_password(email: str) -> int:
    """
    Break-glass recovery for operators with server access: set a user's password,
    unlock the account and sign it out everywhere. Audited; the password is never echoed.
    """
    async with async_session_factory() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user:
            print(f"No user {email}.")
            return 1
        password = getpass.getpass(f"New password for {email}: ")
        errors = password_policy_errors(password)
        if errors:
            print("Password " + "; ".join(errors))
            return 1
        if getpass.getpass("Repeat password: ") != password:
            print("Passwords do not match.")
            return 1

        user.hashed_password = hash_password(password)
        user.password_changed_at = datetime.now(timezone.utc)
        user.must_change_password = False
        user.failed_login_attempts = 0
        user.locked_until = None
        user.revoke_sessions()
        await record_audit(
            db, action="set_password_cli", resource_type="user", resource_id=user.id,
            actor_email="system:cli", details={"email": email},
        )
        await db.commit()
    print(f"Password for {email} updated; existing sessions were signed out.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    boot = sub.add_parser("bootstrap-admin", help="Create the first superadmin")
    boot.add_argument("--email", required=True)
    boot.add_argument("--first-name", default="System")
    boot.add_argument("--last-name", default="Administrator")
    reset = sub.add_parser("set-password", help="Recover an account (operators with server access)")
    reset.add_argument("--email", required=True)
    args = parser.parse_args()

    if args.command == "bootstrap-admin":
        sys.exit(asyncio.run(bootstrap_admin(args.email.lower(), args.first_name, args.last_name)))
    if args.command == "set-password":
        sys.exit(asyncio.run(set_password(args.email.lower())))


if __name__ == "__main__":
    main()
