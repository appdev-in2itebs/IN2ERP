"""
Regression tests for the access-control findings in ERP_AUDIT_REPORT.md.
"""

import jwt
import pytest
from httpx import AsyncClient

from tests.conftest import (
    ADMIN_EMAIL, ADMIN_PASSWORD, API, create_user_with_role, get_app, login, role_id,
)


async def _erp_role_id(client, headers, name):
    roles = (await client.get(f"{API}/roles", headers=headers)).json()
    return next(r["id"] for r in roles if r["name"] == name)


async def _me(client, headers):
    return (await client.get(f"{API}/auth/me", headers=headers)).json()


# ── Authentication ──

@pytest.mark.asyncio
async def test_self_registration_disabled_by_default(client: AsyncClient):
    res = await client.post(f"{API}/auth/register", json={
        "email": "x@example.com", "password": "Strong-Pass-123",
        "first_name": "X", "last_name": "Y",
    })
    assert res.status_code == 403
    assert (await client.get(f"{API}/auth/config")).json()["self_registration_enabled"] is False


@pytest.mark.asyncio
async def test_failed_login_is_audited_and_account_locks(client: AsyncClient, admin_headers):
    for _ in range(5):
        res = await client.post(f"{API}/auth/login",
                                json={"email": ADMIN_EMAIL, "password": "wrong-password-1"})
        assert res.status_code == 401
    res = await client.post(f"{API}/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 423

    logs = (await client.get(f"{API}/audit?action=login_failed", headers=admin_headers)).json()
    assert logs["total"] >= 5
    assert all(log["correlation_id"] for log in logs["logs"])


@pytest.mark.asyncio
async def test_new_user_must_change_temporary_password(client: AsyncClient, admin_headers):
    res = await client.post(f"{API}/users", headers=admin_headers, json={
        "email": "new@in2it.com", "first_name": "New", "last_name": "User",
    })
    assert res.status_code == 201
    temp = res.json()["temporary_password"]
    assert temp and len(temp) >= 12

    headers = await login(client, "new@in2it.com", temp)
    assert (await client.get(f"{API}/applications/my", headers=headers)).status_code == 403
    assert (await _me(client, headers))["must_change_password"] is True

    weak = await client.post(f"{API}/auth/change-password", headers=headers,
                             json={"current_password": temp, "new_password": "short"})
    assert weak.status_code == 422
    shared = await client.post(f"{API}/auth/change-password", headers=headers,
                               json={"current_password": temp, "new_password": "password123"})
    assert shared.status_code == 422

    ok = await client.post(f"{API}/auth/change-password", headers=headers,
                           json={"current_password": temp, "new_password": "Brand-New-Pass-9"})
    assert ok.status_code == 200
    new_headers = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    assert (await client.get(f"{API}/applications/my", headers=new_headers)).status_code == 200
    assert (await client.get(f"{API}/auth/me", headers=headers)).status_code == 401


@pytest.mark.asyncio
async def test_token_signed_with_old_default_key_rejected(client: AsyncClient, admin_headers):
    admin_id = (await _me(client, admin_headers))["id"]
    forged = jwt.encode({"sub": admin_id, "type": "access", "tv": 0, "iat": 0,
                         "exp": 4102444800}, "change-me-jwt-" + "x" * 32, algorithm="HS256")
    res = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


# ── Privilege escalation ──

@pytest.mark.asyncio
async def test_admin_cannot_assign_super_admin_role(client: AsyncClient, admin_headers):
    admin_user, headers = await create_user_with_role(client, admin_headers, "adm@in2it.com", "Admin")
    super_role = await _erp_role_id(client, admin_headers, "Super Admin")

    res = await client.post(f"{API}/roles/assign", headers=headers,
                            json={"user_id": admin_user["id"], "role_id": super_role})
    assert res.status_code == 403
    other, _ = await create_user_with_role(client, admin_headers, "other@in2it.com")
    res = await client.post(f"{API}/roles/assign", headers=headers,
                            json={"user_id": other["id"], "role_id": super_role})
    assert res.status_code == 403

    manager_role = await _erp_role_id(client, admin_headers, "Manager")
    res = await client.post(f"{API}/roles/assign", headers=headers,
                            json={"user_id": other["id"], "role_id": manager_role})
    assert res.status_code == 201


@pytest.mark.asyncio
async def test_admin_cannot_take_over_superadmin(client: AsyncClient, admin_headers):
    _, headers = await create_user_with_role(client, admin_headers, "adm2@in2it.com", "Admin")
    super_id = (await _me(client, admin_headers))["id"]

    assert (await client.post(f"{API}/users/{super_id}/reset-password", headers=headers,
                              json={})).status_code == 403
    assert (await client.patch(f"{API}/users/{super_id}", headers=headers,
                               json={"is_active": False})).status_code == 403
    assert (await client.post(f"{API}/assignments/user/{super_id}/changes", headers=headers,
                              json={"grants": [], "revokes": ["x"]})).status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_change_own_access_or_deactivate_self(client: AsyncClient, admin_headers):
    admin_user, headers = await create_user_with_role(client, admin_headers, "adm3@in2it.com", "Admin")
    assert (await client.patch(f"{API}/users/{admin_user['id']}", headers=headers,
                               json={"is_active": False})).status_code == 403
    finance = await get_app(client, admin_headers, "finance")
    res = await client.post(f"{API}/assignments/user/{admin_user['id']}/changes", headers=headers,
                            json={"grants": [{"application_id": finance["id"],
                                              "app_role_id": role_id(finance, "Finance Controller")}]})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_employee_cannot_call_admin_apis(client: AsyncClient, admin_headers):
    user, headers = await create_user_with_role(client, admin_headers, "plain@in2it.com")
    other, _ = await create_user_with_role(client, admin_headers, "colleague@in2it.com")
    for path in ("/users", "/dashboard/stats", "/audit", "/users/departments",
                 f"/users/{other['id']}", f"/assignments/user/{other['id']}", "/provisioning/jobs"):
        assert (await client.get(f"{API}{path}", headers=headers)).status_code == 403, path
    finance = await get_app(client, admin_headers, "finance")
    res = await client.post(f"{API}/assignments/user/{user['id']}/changes", headers=headers,
                            json={"grants": [{"application_id": finance["id"],
                                              "app_role_id": role_id(finance, "Viewer")}]})
    assert res.status_code == 403
    logs = (await client.get(f"{API}/audit?action=permission_denied", headers=admin_headers)).json()
    assert logs["total"] >= 1


@pytest.mark.asyncio
async def test_manager_cannot_grant_access(client: AsyncClient, admin_headers):
    _, headers = await create_user_with_role(client, admin_headers, "mgr@in2it.com", "Manager")
    target, _ = await create_user_with_role(client, admin_headers, "team@in2it.com")
    finance = await get_app(client, admin_headers, "finance")
    res = await client.post(f"{API}/assignments", headers=headers, json={
        "user_id": target["id"], "application_id": finance["id"],
        "app_role_id": role_id(finance, "Viewer"),
    })
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_deactivation_revokes_sessions_and_access(client: AsyncClient, admin_headers):
    user, headers = await create_user_with_role(client, admin_headers, "leaver@in2it.com")
    finance = await get_app(client, admin_headers, "finance")
    await client.post(f"{API}/assignments", headers=admin_headers, json={
        "user_id": user["id"], "application_id": finance["id"],
        "app_role_id": role_id(finance, "Accountant"),
    })
    res = await client.patch(f"{API}/users/{user['id']}", headers=admin_headers, json={"is_active": False})
    assert res.status_code == 200
    assert (await client.get(f"{API}/applications/my", headers=headers)).status_code in (401, 403)

    history = (await client.get(f"{API}/assignments/user/{user['id']}?include_history=true",
                                headers=admin_headers)).json()
    assert [a["status"] for a in history] == ["revoked"]
    assert history[0]["provisioning_status"] == "manual_action_required"


@pytest.mark.asyncio
async def test_audit_log_is_append_only(db_session):
    from sqlalchemy import select
    from app.models.audit import AuditLog
    from app.services.audit_service import record_audit

    await record_audit(db_session, action="test", resource_type="test")
    await db_session.commit()
    log = (await db_session.execute(select(AuditLog))).scalars().first()
    log.action = "tampered"
    with pytest.raises(PermissionError):
        await db_session.flush()
