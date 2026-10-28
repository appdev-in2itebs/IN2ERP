"""
Controlled bootstrap of the first administrator (python -m app.cli bootstrap-admin).
"""

import pytest
from sqlalchemy import select

from app import cli
from app.models.audit import AuditLog
from app.models.user import User
from tests.conftest import test_session_factory as db_factory


@pytest.fixture
def empty_db(db_session, monkeypatch):
    """The test database is seeded with an admin; remove it to simulate a fresh install."""
    monkeypatch.setattr(cli, "async_session_factory", db_factory)


async def _drop_admins():
    async with db_factory() as db:
        for user in (await db.execute(select(User))).scalars():
            await db.delete(user)
        await db.commit()


@pytest.mark.asyncio
async def test_bootstrap_creates_first_admin_without_printing_password(empty_db, monkeypatch, capsys):
    await _drop_admins()
    monkeypatch.setattr(cli.getpass, "getpass", lambda prompt="": "Bootstrap-Pass-2026")
    assert await cli.bootstrap_admin("owner@in2it.com", "Erp", "Owner") == 0
    assert "Bootstrap-Pass-2026" not in capsys.readouterr().out

    async with db_factory() as db:
        admin = (await db.execute(select(User).where(User.email == "owner@in2it.com"))).scalar_one()
        assert admin.is_superadmin
        actions = (await db.execute(select(AuditLog.action))).scalars().all()
        assert "bootstrap_admin" in actions


@pytest.mark.asyncio
async def test_bootstrap_refuses_when_admin_exists(empty_db, monkeypatch):
    monkeypatch.setattr(cli.getpass, "getpass", lambda prompt="": "Bootstrap-Pass-2026")
    assert await cli.bootstrap_admin("second@in2it.com", "Second", "Admin") == 1


@pytest.mark.asyncio
async def test_bootstrap_enforces_password_policy(empty_db, monkeypatch):
    await _drop_admins()
    monkeypatch.setattr(cli.getpass, "getpass", lambda prompt="": "password123")
    assert await cli.bootstrap_admin("owner@in2it.com", "Erp", "Owner") == 1
