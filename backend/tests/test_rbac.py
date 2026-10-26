import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_roles_and_permissions(client: AsyncClient):
    # Login as admin
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@in2it.com", "password": "admin123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List roles
    roles_res = await client.get("/api/v1/roles", headers=headers)
    assert roles_res.status_code == 200
    roles = roles_res.json()
    role_names = [r["name"] for r in roles]
    assert "Super Admin" in role_names
    assert "Admin" in role_names
    assert "Manager" in role_names
    assert "Employee" in role_names

    # List permissions
    perms_res = await client.get("/api/v1/roles/permissions", headers=headers)
    assert perms_res.status_code == 200
    perms = perms_res.json()
    assert len(perms) > 10


@pytest.mark.asyncio
async def test_create_and_delete_custom_role(client: AsyncClient):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@in2it.com", "password": "admin123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create new role
    create_res = await client.post(
        "/api/v1/roles",
        headers=headers,
        json={
            "name": "Quality Assurance",
            "description": "QA team role",
            "color": "#10B981",
            "permission_ids": [],
        },
    )
    assert create_res.status_code == 201
    created_role = create_res.json()
    assert created_role["name"] == "Quality Assurance"

    # Delete custom role
    del_res = await client.delete(f"/api/v1/roles/{created_role['id']}", headers=headers)
    assert del_res.status_code == 204
