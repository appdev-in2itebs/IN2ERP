import os
import tempfile

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db.database import Base, get_db, get_session_factory
from app.db.seed import seed_database
from app.main import app

ADMIN_EMAIL = "admin@in2it.com"
ADMIN_PASSWORD = "Test-Admin-Pass-2026"
API = "/api/v1"

# A file-backed database so the provisioning worker's own sessions see the same data.
_db_dir = tempfile.mkdtemp(prefix="in2erp-tests-")
TEST_DB_URL = f"sqlite+aiosqlite:///{os.path.join(_db_dir, 'test.db')}"
test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_factory() as session:
        await seed_database(session, admin_password=ADMIN_PASSWORD)

    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    async def override_get_db():
        async with test_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_session_factory] = lambda: test_session_factory
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def login(client: AsyncClient, email: str, password: str) -> dict:
    res = await client.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient) -> dict:
    return await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)


async def create_user_with_role(
    client: AsyncClient, admin_headers: dict, email: str, role_name: str | None = None
) -> tuple[dict, dict]:
    """Create a user as superadmin, optionally give it an ERP role, and sign it in
    (completing the forced password change). Returns (user, auth headers)."""
    res = await client.post(f"{API}/users", headers=admin_headers, json={
        "email": email, "first_name": "Test", "last_name": email.split("@")[0],
    })
    assert res.status_code == 201, res.text
    user = res.json()
    temp = user["temporary_password"]

    if role_name:
        roles = (await client.get(f"{API}/roles", headers=admin_headers)).json()
        role = next(r for r in roles if r["name"] == role_name)
        res = await client.post(f"{API}/roles/assign", headers=admin_headers,
                                json={"user_id": user["id"], "role_id": role["id"]})
        assert res.status_code == 201, res.text

    headers = await login(client, email, temp)
    res = await client.post(f"{API}/auth/change-password", headers=headers,
                            json={"current_password": temp, "new_password": "Changed-Pass-2026"})
    assert res.status_code == 200, res.text
    return user, {"Authorization": f"Bearer {res.json()['access_token']}"}


async def get_app(client: AsyncClient, headers: dict, slug: str) -> dict:
    apps = (await client.get(f"{API}/applications", headers=headers)).json()
    return next(a for a in apps if a["slug"] == slug)


def role_id(app: dict, name: str) -> str:
    return next(r["id"] for r in app["roles"] if r["name"] == name)
