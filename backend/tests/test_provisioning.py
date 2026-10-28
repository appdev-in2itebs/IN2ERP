"""
Provisioning workflow against simulated target applications.
HTTP calls from connectors are routed to in-process fakes via httpx.MockTransport.
"""

import json
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote

import httpx
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import update

from app.integrations.base import ConnectorError, Subject
from app.integrations.entra_graph import EntraAppRoleConnector
from app.integrations.registry import set_http_transport
from app.integrations.scim import ScimConnector
from app.models.application import AppAssignment
from app.models.provisioning import ProvisioningJob
from tests.conftest import API, create_user_with_role
from tests.conftest import test_session_factory as db_factory

BASE = "https://target.test/in2erp/v1"


class FakeTargetApp:
    """A target application implementing the In2ERP custom provisioning contract."""

    def __init__(self):
        self.roles = {"r-admin": "Administrator", "r-agent": "Agent", "r-viewer": "Viewer"}
        self.holdings: dict[str, set[str]] = {}
        self.fail_next = 0          # respond 503 to the next N mutating calls
        self.ignore_writes = False  # accept writes without applying them
        self.calls: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer target-secret"
        path = request.url.path.removeprefix("/in2erp/v1")
        self.calls.append(f"{request.method} {path}")
        if path == "/health":
            return httpx.Response(200, json={"ok": True})
        if path == "/roles":
            return httpx.Response(200, json={"roles": [{"id": k, "name": v} for k, v in self.roles.items()]})
        parts = path.split("/")  # ['', 'users', email, 'roles', role?]
        email = unquote(parts[2])
        held = self.holdings.setdefault(email, set())
        if request.method == "GET":
            return httpx.Response(200, json={"roles": sorted(held)})
        if self.fail_next:
            self.fail_next -= 1
            return httpx.Response(503, text="maintenance")
        role = unquote(parts[4])
        if not self.ignore_writes:
            (held.add if request.method == "PUT" else held.discard)(role)
        return httpx.Response(204)


@pytest_asyncio.fixture
async def target(monkeypatch):
    fake = FakeTargetApp()
    monkeypatch.setenv("TARGET_API_TOKEN", "target-secret")
    set_http_transport(httpx.MockTransport(fake.handler))
    yield fake
    set_http_transport(None)


async def _register(client, headers, secret_ref="TARGET_API_TOKEN"):
    res = await client.post(f"{API}/applications", headers=headers, json={
        "name": "Target", "slug": "target", "url": "https://target.test",
        "integration_type": "custom_api", "connector_config": {"base_url": BASE},
        "connector_secret_ref": secret_ref,
    })
    assert res.status_code == 201, res.text
    return res.json()


async def _grant(client, headers, user_id, app_id, role_id, **extra):
    res = await client.post(f"{API}/assignments/user/{user_id}/changes", headers=headers,
                            json={"grants": [{"application_id": app_id, "app_role_id": role_id, **extra}]})
    assert res.status_code == 200, res.text
    return res.json()["assignments"][0]


async def _run(client, headers):
    res = await client.post(f"{API}/provisioning/run", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


async def _assignment(client, headers, user_id, assignment_id):
    rows = (await client.get(f"{API}/assignments/user/{user_id}?include_history=true", headers=headers)).json()
    return next(a for a in rows if a["id"] == assignment_id)


async def _synced_roles(client, headers, app_id):
    res = await client.post(f"{API}/applications/{app_id}/roles/sync", headers=headers)
    assert res.status_code == 200, res.text
    return {r["name"]: r for r in res.json()["roles"]}


@pytest.mark.asyncio
async def test_connection_test_and_role_sync(client: AsyncClient, admin_headers, target):
    app = await _register(client, admin_headers)
    res = await client.post(f"{API}/applications/{app['id']}/test-connection", headers=admin_headers)
    assert res.json() == {"ok": True, "integration_status": "healthy", "message": "Connection succeeded"}

    roles = await _synced_roles(client, admin_headers, app["id"])
    assert set(roles) == {"Administrator", "Agent", "Viewer"}
    assert all(r["source"] == "connector" and r["sync_status"] == "verified" for r in roles.values())

    del target.roles["r-viewer"]
    roles = await _synced_roles(client, admin_headers, app["id"])
    assert roles["Viewer"]["sync_status"] == "missing"  # flagged, never silently deleted


@pytest.mark.asyncio
async def test_grant_is_verified_before_launch(client: AsyncClient, admin_headers, target):
    app = await _register(client, admin_headers)
    roles = await _synced_roles(client, admin_headers, app["id"])
    user, headers = await create_user_with_role(client, admin_headers, "agent@in2it.com")

    granted = await _grant(client, admin_headers, user["id"], app["id"], roles["Agent"]["id"])
    assert granted["provisioning_status"] == "pending"
    my = (await client.get(f"{API}/applications/my", headers=headers)).json()
    assert my[0]["access_state"] == "pending" and my[0]["url"] is None

    assert (await _run(client, admin_headers))["jobs"] == {"succeeded": 1}
    assert target.holdings["agent@in2it.com"] == {"r-agent"}
    assert (await _assignment(client, admin_headers, user["id"], granted["id"]))["provisioning_status"] == "verified"
    my = (await client.get(f"{API}/applications/my", headers=headers)).json()
    assert my[0]["access_state"] == "ready" and my[0]["url"] == "https://target.test"


@pytest.mark.asyncio
async def test_transient_failures_retry_then_fail_then_admin_retry(client: AsyncClient, admin_headers, target):
    app = await _register(client, admin_headers)
    roles = await _synced_roles(client, admin_headers, app["id"])
    user, _ = await create_user_with_role(client, admin_headers, "flaky@in2it.com")
    granted = await _grant(client, admin_headers, user["id"], app["id"], roles["Agent"]["id"])

    target.fail_next = 1
    assert (await _run(client, admin_headers))["jobs"] == {"queued": 1}
    row = await _assignment(client, admin_headers, user["id"], granted["id"])
    assert row["provisioning_status"] == "pending" and "retrying" in row["last_error"]

    # Exhaust the remaining attempts (make the queued job due immediately each time)
    target.fail_next = 10
    for _ in range(5):
        async with db_factory() as db:
            await db.execute(update(ProvisioningJob).values(next_attempt_at=datetime.now(timezone.utc)))
            await db.commit()
        await _run(client, admin_headers)
    row = await _assignment(client, admin_headers, user["id"], granted["id"])
    assert row["provisioning_status"] == "failed" and "503" in row["last_error"]
    assert "agent" not in str(target.holdings.get("flaky@in2it.com", set()))

    target.fail_next = 0
    res = await client.post(f"{API}/assignments/{granted['id']}/retry", headers=admin_headers)
    assert res.json()["provisioning_status"] == "pending"
    await _run(client, admin_headers)
    assert (await _assignment(client, admin_headers, user["id"], granted["id"]))["provisioning_status"] == "verified"


@pytest.mark.asyncio
async def test_revocation_reaches_target_and_is_verified(client: AsyncClient, admin_headers, target):
    app = await _register(client, admin_headers)
    roles = await _synced_roles(client, admin_headers, app["id"])
    user, headers = await create_user_with_role(client, admin_headers, "leaver@in2it.com")
    granted = await _grant(client, admin_headers, user["id"], app["id"], roles["Administrator"]["id"])
    await _run(client, admin_headers)

    res = await client.delete(f"{API}/assignments/{granted['id']}", headers=admin_headers)
    assert res.json()["provisioning_status"] == "revocation_pending"
    assert (await client.get(f"{API}/applications/my", headers=headers)).json() == []
    await _run(client, admin_headers)
    assert target.holdings["leaver@in2it.com"] == set()
    assert (await _assignment(client, admin_headers, user["id"], granted["id"]))["provisioning_status"] == "revoked"


@pytest.mark.asyncio
async def test_stale_grant_cannot_restore_revoked_access(client: AsyncClient, admin_headers, target):
    app = await _register(client, admin_headers)
    roles = await _synced_roles(client, admin_headers, app["id"])
    user, _ = await create_user_with_role(client, admin_headers, "race@in2it.com")

    granted = await _grant(client, admin_headers, user["id"], app["id"], roles["Agent"]["id"])
    await client.delete(f"{API}/assignments/{granted['id']}", headers=admin_headers)  # before the worker ran
    result = await _run(client, admin_headers)
    assert result["jobs"] == {"superseded": 1, "succeeded": 1}
    assert target.holdings.get("race@in2it.com", set()) == set()
    assert not any(c.startswith("PUT") for c in target.calls)  # the stale grant never ran


@pytest.mark.asyncio
async def test_unconfirmed_write_needs_reconciliation(client: AsyncClient, admin_headers, target):
    app = await _register(client, admin_headers)
    roles = await _synced_roles(client, admin_headers, app["id"])
    user, headers = await create_user_with_role(client, admin_headers, "ghost@in2it.com")
    target.ignore_writes = True
    granted = await _grant(client, admin_headers, user["id"], app["id"], roles["Agent"]["id"])
    await _run(client, admin_headers)
    row = await _assignment(client, admin_headers, user["id"], granted["id"])
    assert row["provisioning_status"] == "reconciliation_required"
    assert (await client.get(f"{API}/applications/my", headers=headers)).json()[0]["access_state"] == "pending"


@pytest.mark.asyncio
async def test_missing_credential_fails_without_pretending(client: AsyncClient, admin_headers, target):
    app = await _register(client, admin_headers, secret_ref="NOT_SET_ANYWHERE")
    res = await client.post(f"{API}/applications/{app['id']}/test-connection", headers=admin_headers)
    assert res.json()["ok"] is False and "not available" in res.json()["message"]
    role = await client.post(f"{API}/applications/{app['id']}/roles", headers=admin_headers,
                             json={"name": "Agent", "external_role_id": "r-agent"})
    user, _ = await create_user_with_role(client, admin_headers, "nocreds@in2it.com")
    granted = await _grant(client, admin_headers, user["id"], app["id"], role.json()["id"])
    await _run(client, admin_headers)
    row = await _assignment(client, admin_headers, user["id"], granted["id"])
    assert row["provisioning_status"] == "failed" and "not available" in row["last_error"]
    assert target.calls == []


@pytest.mark.asyncio
async def test_expired_assignment_is_revoked_in_target(client: AsyncClient, admin_headers, target):
    app = await _register(client, admin_headers)
    roles = await _synced_roles(client, admin_headers, app["id"])
    user, headers = await create_user_with_role(client, admin_headers, "temp@in2it.com")
    soon = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    granted = await _grant(client, admin_headers, user["id"], app["id"], roles["Viewer"]["id"], expires_at=soon)
    await _run(client, admin_headers)
    assert target.holdings["temp@in2it.com"] == {"r-viewer"}

    async with db_factory() as db:  # time passes
        await db.execute(update(AppAssignment).where(AppAssignment.id == granted["id"])
                         .values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
        await db.commit()
    assert (await client.get(f"{API}/applications/my", headers=headers)).json() == []

    result = await _run(client, admin_headers)
    assert result["expired"] == 1
    assert target.holdings["temp@in2it.com"] == set()
    row = await _assignment(client, admin_headers, user["id"], granted["id"])
    assert row["status"] == "expired" and row["provisioning_status"] == "revoked"


# ── Connector units ──

@pytest.mark.asyncio
async def test_entra_graph_connector_grant_and_revoke(monkeypatch):
    monkeypatch.setenv("GRAPH_CLIENT_SECRET", "graph-secret")
    sp, role, oid = "sp-1", "role-guid", "user-oid"
    assignments: dict[str, str] = {}
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.url.path.endswith("/oauth2/v2.0/token"):
            assert b"client_secret=graph-secret" in request.content
            return httpx.Response(200, json={"access_token": "t", "expires_in": 3600})
        assert request.headers["Authorization"] == "Bearer t"
        if request.url.path == f"/v1.0/users/{oid}/appRoleAssignments":
            return httpx.Response(200, json={"value": [{"appRoleId": r, "id": i} for r, i in assignments.items()]})
        if request.method == "POST":
            body = json.loads(request.content)
            assert body == {"principalId": oid, "resourceId": sp, "appRoleId": role}
            assignments[role] = "assign-1"
            return httpx.Response(201, json={"id": "assign-1"})
        if request.method == "DELETE":
            assert request.url.path.endswith("/appRoleAssignedTo/assign-1")
            assignments.clear()
            return httpx.Response(204)
        return httpx.Response(404)

    from app.core.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "ENTRA_TENANT_ID", "tenant")
    monkeypatch.setattr(settings, "GRAPH_CLIENT_ID", "graph-app")
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        connector = EntraAppRoleConnector({"service_principal_id": sp}, None, client)
        subject = Subject(user_id="u", email="u@in2it.com", entra_object_id=oid)
        await connector.grant(subject, role, "k1")
        await connector.grant(subject, role, "k2")  # idempotent: no second POST
        assert await connector.verify(subject, role, expect_present=True)
        await connector.revoke(subject, role, "k3")
        assert await connector.verify(subject, role, expect_present=False)
        assert sum(1 for m, _ in calls if m == "POST" and "appRoleAssignedTo" in _) == 1

        with pytest.raises(ConnectorError, match="not linked"):
            await connector.grant(Subject(user_id="u", email="u@in2it.com"), role, "k4")


@pytest.mark.asyncio
async def test_scim_connector_group_membership(monkeypatch):
    monkeypatch.setenv("SCIM_TOKEN", "scim-secret")
    members: set[str] = set()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer scim-secret"
        if request.url.path == "/scim/v2/Users":
            return httpx.Response(200, json={"Resources": [{"id": "scim-user-1"}]})
        if request.url.path == "/scim/v2/Groups" and request.method == "GET":
            groups = [{"id": "g-sales"}] if "scim-user-1" in members else []
            return httpx.Response(200, json={"Resources": groups})
        if request.url.path == "/scim/v2/Groups/g-sales" and request.method == "PATCH":
            op = json.loads(request.content)["Operations"][0]
            (members.add if op["op"] == "add" else members.discard)("scim-user-1")
            return httpx.Response(204)
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        connector = ScimConnector({"base_url": "https://app.test/scim/v2"}, "SCIM_TOKEN", client)
        subject = Subject(user_id="u", email="u@in2it.com")
        await connector.grant(subject, "g-sales", "k1")
        assert await connector.verify(subject, "g-sales", expect_present=True)
        await connector.revoke(subject, "g-sales", "k2")
        assert await connector.verify(subject, "g-sales", expect_present=False)
