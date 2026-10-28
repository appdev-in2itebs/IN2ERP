"""
Application registry, role catalogue, access changes and launchpad behaviour.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import API, create_user_with_role, get_app, role_id


async def _changes(client, headers, user_id, grants=(), revokes=(), dry_run=False):
    return await client.post(f"{API}/assignments/user/{user_id}/changes", headers=headers,
                             json={"grants": list(grants), "revokes": list(revokes), "dry_run": dry_run})


@pytest.mark.asyncio
async def test_list_applications_with_catalogues(client: AsyncClient, admin_headers):
    apps = (await client.get(f"{API}/applications", headers=admin_headers)).json()
    crm = next(a for a in apps if a["slug"] == "crm")
    assert {"Sales Manager", "Read Only"} <= {r["name"] for r in crm["roles"]}
    assert crm["integration_type"] == "manual" and crm["integration_status"] == "manual"


@pytest.mark.asyncio
async def test_unknown_application_and_role_rejected(client: AsyncClient, admin_headers):
    user, _ = await create_user_with_role(client, admin_headers, "crm@in2it.com")
    crm = await get_app(client, admin_headers, "crm")
    res = await _changes(client, admin_headers, user["id"],
                         [{"application_id": "nope", "app_role_id": role_id(crm, "Salesperson")}])
    assert res.status_code == 400 and "Unknown application" in res.text
    res = await _changes(client, admin_headers, user["id"],
                         [{"application_id": crm["id"], "app_role_id": "not-a-role"}])
    assert res.status_code == 400 and "Unknown role" in res.text
    res = await _changes(client, admin_headers, user["id"], revokes=["not-an-assignment"])
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_dry_run_review_then_apply_multiple_roles(client: AsyncClient, admin_headers):
    user, headers = await create_user_with_role(client, admin_headers, "multi@in2it.com")
    crm = await get_app(client, admin_headers, "crm")
    grants = [
        {"application_id": crm["id"], "app_role_id": role_id(crm, "Sales Manager")},
        {"application_id": crm["id"], "app_role_id": role_id(crm, "Practice Lead")},
    ]
    review = await _changes(client, admin_headers, user["id"], grants, dry_run=True)
    assert review.status_code == 200
    body = review.json()
    assert body["dry_run"] is True and len(body["changes"]) == 2
    assert "Manual" in body["changes"][0]["outcome"]
    assert (await client.get(f"{API}/assignments/user/{user['id']}", headers=admin_headers)).json() == []

    applied = await _changes(client, admin_headers, user["id"], grants)
    assert applied.status_code == 200
    assignments = applied.json()["assignments"]
    assert {a["app_role"] for a in assignments} == {"Sales Manager", "Practice Lead"}
    assert all(a["provisioning_status"] == "manual_action_required" for a in assignments)

    # Not launchable until confirmed in the target application
    my = (await client.get(f"{API}/applications/my", headers=headers)).json()
    assert my[0]["access_state"] == "pending" and my[0]["url"] is None

    for a in assignments:
        res = await client.post(f"{API}/assignments/{a['id']}/confirm", headers=admin_headers,
                                json={"note": "Granted in CRM by app owner"})
        assert res.json()["provisioning_status"] == "verified"
    my = (await client.get(f"{API}/applications/my", headers=headers)).json()
    assert my[0]["access_state"] == "ready"
    assert my[0]["roles"] == ["Practice Lead", "Sales Manager"]

    # Granting the same role twice is rejected
    dup = await _changes(client, admin_headers, user["id"], grants[:1])
    assert dup.status_code == 400 and "already holds" in dup.text


@pytest.mark.asyncio
async def test_revoke_is_explicit_and_kept_in_history(client: AsyncClient, admin_headers):
    user, headers = await create_user_with_role(client, admin_headers, "rev@in2it.com")
    finance = await get_app(client, admin_headers, "finance")
    reports = await get_app(client, admin_headers, "reports")
    res = await _changes(client, admin_headers, user["id"], [
        {"application_id": finance["id"], "app_role_id": role_id(finance, "Accountant")},
        {"application_id": reports["id"], "app_role_id": role_id(reports, "Viewer")},
    ])
    finance_assignment = next(a for a in res.json()["assignments"] if a["application_id"] == finance["id"])

    res = await _changes(client, admin_headers, user["id"], revokes=[finance_assignment["id"]])
    assert res.status_code == 200
    revoked = res.json()["assignments"][0]
    assert revoked["status"] == "revoked"
    assert revoked["provisioning_status"] == "manual_action_required"  # not shown as done yet

    active = (await client.get(f"{API}/assignments/user/{user['id']}", headers=admin_headers)).json()
    assert [a["application_id"] for a in active] == [reports["id"]]  # reports untouched
    history = (await client.get(f"{API}/assignments/user/{user['id']}?include_history=true",
                                headers=admin_headers)).json()
    assert len(history) == 2

    confirm = await client.post(f"{API}/assignments/{revoked['id']}/confirm", headers=admin_headers, json={})
    assert confirm.json()["provisioning_status"] == "revoked"

    names = {log["action"] for log in (await client.get(
        f"{API}/audit?resource_type=assignment", headers=admin_headers)).json()["logs"]}
    assert {"grant_app_access", "revoke_app_access", "manual_confirmation"} <= names


@pytest.mark.asyncio
async def test_expired_assignment_not_launchable(client: AsyncClient, admin_headers):
    user, headers = await create_user_with_role(client, admin_headers, "exp@in2it.com")
    reports = await get_app(client, admin_headers, "reports")
    past = await _changes(client, admin_headers, user["id"], [{
        "application_id": reports["id"], "app_role_id": role_id(reports, "Viewer"),
        "expires_at": "2020-01-01T00:00:00Z",
    }])
    assert past.status_code == 400 and "in the past" in past.text


@pytest.mark.asyncio
async def test_max_users_counts_people_not_roles(client: AsyncClient, admin_headers):
    res = await client.post(f"{API}/applications", headers=admin_headers, json={
        "name": "Tiny", "slug": "tiny", "max_users": 1,
        "roles": [{"name": "User", "is_default": True}, {"name": "Admin"}],
    })
    app = res.json()
    u1, _ = await create_user_with_role(client, admin_headers, "t1@in2it.com")
    u2, _ = await create_user_with_role(client, admin_headers, "t2@in2it.com")
    both = await _changes(client, admin_headers, u1["id"], [
        {"application_id": app["id"], "app_role_id": role_id(app, "User")},
        {"application_id": app["id"], "app_role_id": role_id(app, "Admin")},
    ])
    assert both.status_code == 200
    full = await _changes(client, admin_headers, u2["id"],
                          [{"application_id": app["id"], "app_role_id": role_id(app, "User")}])
    assert full.status_code == 400 and "maximum" in full.text


@pytest.mark.asyncio
async def test_app_registry_and_catalogue_management(client: AsyncClient, admin_headers):
    res = await client.post(f"{API}/applications", headers=admin_headers, json={
        "name": "In2Test", "slug": "In2 Test", "url": "https://in2test.example.com",
        "integration_type": "custom_api",
        "connector_config": {"base_url": "https://in2test.example.com/in2erp/v1"},
        "connector_secret_ref": "IN2TEST_API_TOKEN",
        "roles": [{"name": "Owner", "external_role_id": "owner"}, {"name": "Member", "is_default": True}],
    })
    assert res.status_code == 201, res.text
    app = res.json()
    assert app["slug"] == "in2-test" and app["integration_status"] == "configured"
    assert [r["name"] for r in app["roles"]] == ["Owner", "Member"]

    dup = await client.post(f"{API}/applications/{app['id']}/roles", headers=admin_headers,
                            json={"name": "owner"})
    assert dup.status_code == 409
    for url in ("javascript:alert(1)", "//evil.example.com", "/\\evil.example.com"):
        bad_url = await client.patch(f"{API}/applications/{app['id']}", headers=admin_headers,
                                     json={"url": url})
        assert bad_url.status_code == 422, url
    secret_in_config = await client.patch(f"{API}/applications/{app['id']}", headers=admin_headers,
                                          json={"connector_config": {"api_key": "abc"}})
    assert secret_in_config.status_code == 422
    secret_as_ref = await client.patch(f"{API}/applications/{app['id']}", headers=admin_headers,
                                       json={"connector_secret_ref": "sk-live-1234567890abcdef"})
    assert secret_as_ref.status_code == 422

    # A role in use cannot be deleted
    user, _ = await create_user_with_role(client, admin_headers, "owner@in2it.com")
    await _changes(client, admin_headers, user["id"],
                   [{"application_id": app["id"], "app_role_id": role_id(app, "Owner")}])
    res = await client.delete(f"{API}/applications/{app['id']}/roles/{role_id(app, 'Owner')}",
                              headers=admin_headers)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_dashboard_stats_for_admins(client: AsyncClient, admin_headers):
    stats = (await client.get(f"{API}/dashboard/stats", headers=admin_headers)).json()
    assert stats["total_employees"] >= 1 and stats["total_applications"] >= 1
