"""
Microsoft Entra access-token validation and identity mapping.
Tokens are signed with a locally generated RSA key standing in for Entra's signing keys.
"""

import time
import uuid

import jwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import AsyncClient

from app.core.config import get_settings
from app.core.entra import EntraTokenValidator, set_entra_validator
from tests.conftest import ADMIN_EMAIL, API, create_user_with_role

TENANT = "11111111-1111-1111-1111-111111111111"
OTHER_TENANT = "22222222-2222-2222-2222-222222222222"
API_CLIENT = "33333333-3333-3333-3333-333333333333"
SPA_CLIENT = "44444444-4444-4444-4444-444444444444"

SIGNING_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ATTACKER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _Key:
    def __init__(self, key):
        self.key = key


class FakeJwks:
    """Stands in for PyJWKClient: always returns the test tenant's public key."""

    def get_signing_key_from_jwt(self, token):
        return _Key(SIGNING_KEY.public_key())


def make_token(*, oid=None, email="someone@in2it.com", roles=(), tid=TENANT, aud=None,
               scp="access_as_user", iss=None, exp_in=3600, key=SIGNING_KEY, drop=()):
    now = int(time.time())
    claims = {
        "aud": aud or f"api://{API_CLIENT}",
        "iss": iss or f"https://login.microsoftonline.com/{tid}/v2.0",
        "tid": tid, "oid": oid or str(uuid.uuid4()),
        "iat": now, "nbf": now, "exp": now + exp_in,
        "preferred_username": email, "name": "Entra User", "roles": list(roles),
    }
    if scp:
        claims["scp"] = scp
    for name in drop:
        claims.pop(name, None)
    token = jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})
    return {"Authorization": f"Bearer {token}"}, claims.get("oid")


@pytest_asyncio.fixture
async def entra(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "ENTRA_TENANT_ID", TENANT)
    monkeypatch.setattr(settings, "ENTRA_API_CLIENT_ID", API_CLIENT)
    monkeypatch.setattr(settings, "ENTRA_SPA_CLIENT_ID", SPA_CLIENT)
    monkeypatch.setattr(settings, "ENTRA_ALLOWED_TENANT_IDS", [])
    monkeypatch.setattr(settings, "LOCAL_AUTH_MODE", "all")
    set_entra_validator(EntraTokenValidator(settings, jwks_client=FakeJwks()))
    yield settings
    set_entra_validator(None)


@pytest.mark.asyncio
async def test_config_exposes_public_msal_settings_only(client: AsyncClient, entra):
    config = (await client.get(f"{API}/auth/config")).json()
    assert config["entra_enabled"] is True
    assert config["entra"] == {
        "client_id": SPA_CLIENT,
        "authority": f"https://login.microsoftonline.com/{TENANT}",
        "api_scope": f"api://{API_CLIENT}/access_as_user",
    }


@pytest.mark.asyncio
async def test_first_sign_in_links_existing_employee_by_email(client: AsyncClient, admin_headers, entra):
    user, _ = await create_user_with_role(client, admin_headers, "linkme@in2it.com")
    headers, oid = make_token(email="LinkMe@in2it.com")
    me = await client.get(f"{API}/auth/me", headers=headers)
    assert me.status_code == 200
    body = me.json()
    assert body["id"] == user["id"] and body["auth_method"] == "entra" and body["entra_linked"]

    # The next sign-in matches on object ID, even if the email changes
    again, _ = make_token(oid=oid, email="renamed@in2it.com")
    assert (await client.get(f"{API}/auth/me", headers=again)).json()["id"] == user["id"]


@pytest.mark.asyncio
async def test_unregistered_identity_is_rejected_and_audited(client: AsyncClient, admin_headers, entra):
    headers, _ = make_token(email="stranger@contoso.com")
    res = await client.get(f"{API}/auth/me", headers=headers)
    assert res.status_code == 403
    logs = (await client.get(f"{API}/audit?action=login_failed", headers=admin_headers)).json()
    assert any("entra_identity_not_registered" in (log["details"] or "") for log in logs["logs"])


@pytest.mark.asyncio
async def test_link_conflict_is_rejected(client: AsyncClient, admin_headers, entra):
    user, _ = await create_user_with_role(client, admin_headers, "taken@in2it.com")
    res = await client.put(f"{API}/users/{user['id']}/entra-link", headers=admin_headers, json={
        "entra_object_id": str(uuid.uuid4()), "entra_tenant_id": TENANT,
    })
    assert res.status_code == 200
    headers, _ = make_token(email="taken@in2it.com")  # different object ID, same email
    assert (await client.get(f"{API}/auth/me", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_signing_in_never_grants_admin_rights(client: AsyncClient, admin_headers, entra):
    # Even the superadmin record has only baseline permissions without the ERP.Admin app role
    headers, oid = make_token(email=ADMIN_EMAIL)
    me = (await client.get(f"{API}/auth/me", headers=headers)).json()
    assert me["is_superadmin"] is False
    assert set(me["permissions"]) <= {"dashboard.read", "applications.read"}
    assert (await client.get(f"{API}/users", headers=headers)).status_code == 403

    admin, _ = make_token(oid=oid, email=ADMIN_EMAIL, roles=["ERP.Admin"])
    assert (await client.get(f"{API}/users", headers=admin)).status_code == 200


@pytest.mark.asyncio
async def test_app_role_alone_does_not_grant_erp_permissions(client: AsyncClient, admin_headers, entra):
    await create_user_with_role(client, admin_headers, "employee@in2it.com")
    headers, _ = make_token(email="employee@in2it.com", roles=["ERP.Admin"])
    assert (await client.get(f"{API}/users", headers=headers)).status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("variant", [
    "expired", "wrong_audience", "id_token", "wrong_tenant", "wrong_issuer",
    "missing_scope", "forged_signature", "missing_oid",
])
async def test_invalid_entra_tokens_rejected(client: AsyncClient, admin_headers, entra, variant):
    await create_user_with_role(client, admin_headers, "valid@in2it.com")
    kwargs = {
        "expired": {"exp_in": -600},
        "wrong_audience": {"aud": "api://some-other-api"},
        "id_token": {"aud": SPA_CLIENT, "scp": None},
        "wrong_tenant": {"tid": OTHER_TENANT},
        "wrong_issuer": {"iss": "https://evil.example.com/v2.0"},
        "missing_scope": {"scp": None},
        "forged_signature": {"key": ATTACKER_KEY},
        "missing_oid": {"drop": ("oid",)},
    }[variant]
    headers, _ = make_token(email="valid@in2it.com", **kwargs)
    assert (await client.get(f"{API}/auth/me", headers=headers)).status_code == 401


@pytest.mark.asyncio
async def test_entra_tokens_rejected_when_entra_not_configured(client: AsyncClient):
    headers, _ = make_token(email=ADMIN_EMAIL, roles=["ERP.Admin"])
    assert (await client.get(f"{API}/auth/me", headers=headers)).status_code == 401
