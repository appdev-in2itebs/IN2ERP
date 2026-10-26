import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_applications(client: AsyncClient):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@in2it.com", "password": "admin123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/applications", headers=headers)
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) >= 5
    app_names = [a["name"] for a in apps]
    assert "HR Management" in app_names
    assert "Finance & Accounting" in app_names


@pytest.mark.asyncio
async def test_dashboard_stats(client: AsyncClient):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@in2it.com", "password": "admin123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/dashboard/stats", headers=headers)
    assert res.status_code == 200
    stats = res.json()
    assert stats["total_employees"] >= 1
    assert stats["total_applications"] >= 1
