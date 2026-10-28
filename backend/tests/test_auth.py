import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, API, create_user_with_role, login

CSRF = {"X-Requested-With": "In2ERP"}


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.headers.get("x-request-id")


@pytest.mark.asyncio
async def test_login_sets_httponly_refresh_cookie(client: AsyncClient):
    response = await client.post(f"{API}/auth/login",
                                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] and data["token_type"] == "bearer"
    assert "refresh_token" not in data  # never exposed to page scripts
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=strict" in cookie and "Path=/api/v1/auth" in cookie


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    response = await client.post(f"{API}/auth/login",
                                 json={"email": ADMIN_EMAIL, "password": "not-the-password-1"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_profile(client: AsyncClient, admin_headers):
    me = await client.get(f"{API}/auth/me", headers=admin_headers)
    assert me.status_code == 200
    profile = me.json()
    assert profile["email"] == ADMIN_EMAIL
    assert profile["is_superadmin"] is True
    assert profile["auth_method"] == "local"
    assert "assignments.create" in profile["permissions"]


@pytest.mark.asyncio
async def test_refresh_rotates_and_detects_replay(client: AsyncClient):
    await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    name = get_settings().REFRESH_COOKIE_NAME
    first = client.cookies.get(name)

    # CSRF header is required
    assert (await client.post(f"{API}/auth/refresh")).status_code == 403

    res = await client.post(f"{API}/auth/refresh", headers=CSRF)
    assert res.status_code == 200
    second = client.cookies.get(name)
    assert second and second != first

    # Replaying the first (already used) token revokes the whole family...
    client.cookies.set(name, first, path="/api/v1/auth")
    assert (await client.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 401
    # ...so the newer token from the same family no longer works either.
    client.cookies.set(name, second, path="/api/v1/auth")
    assert (await client.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_access_and_refresh(client: AsyncClient):
    headers = await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    name = get_settings().REFRESH_COOKIE_NAME
    refresh = client.cookies.get(name)
    assert (await client.post(f"{API}/auth/logout", headers=headers)).status_code == 204
    assert (await client.get(f"{API}/auth/me", headers=headers)).status_code == 401
    client.cookies.set(name, refresh, path="/api/v1/auth")
    assert (await client.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 401


@pytest.mark.asyncio
async def test_password_reset_ends_existing_sessions(client: AsyncClient, admin_headers):
    user, headers = await create_user_with_role(client, admin_headers, "reset@in2it.com")
    assert (await client.get(f"{API}/auth/me", headers=headers)).status_code == 200
    res = await client.post(f"{API}/users/{user['id']}/reset-password", headers=admin_headers, json={})
    assert res.status_code == 200 and res.json()["temporary_password"]
    assert (await client.get(f"{API}/auth/me", headers=headers)).status_code == 401


@pytest.mark.asyncio
async def test_break_glass_only_mode(client: AsyncClient, admin_headers, monkeypatch):
    _, staff_headers = await create_user_with_role(client, admin_headers, "staff@in2it.com")
    settings = get_settings()
    monkeypatch.setattr(settings, "LOCAL_AUTH_MODE", "break_glass_only")
    monkeypatch.setattr(settings, "BREAK_GLASS_EMAILS", [ADMIN_EMAIL])

    denied = await client.post(f"{API}/auth/login",
                               json={"email": "staff@in2it.com", "password": "Changed-Pass-2026"})
    assert denied.status_code == 403
    assert (await client.post(f"{API}/auth/login",
                              json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})).status_code == 200
    # Existing password sessions of non-break-glass users stop working too
    assert (await client.get(f"{API}/auth/me", headers=staff_headers)).status_code == 401
