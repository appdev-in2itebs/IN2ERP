"""
In2IT ERP - SCIM 2.0 connector

Use when the target application exposes SCIM 2.0 and models its roles as SCIM Groups.
The target application is the system of record for role membership.

Configuration (applications.connector_config):
    {"base_url": "https://app.example.com/scim/v2"}
Role catalogue: AppRole.external_role_id = the SCIM Group id.
Credentials: bearer token named by connector_secret_ref.
The employee must already exist in the target as a SCIM User whose userName is their
email address; this connector manages role membership, not user creation.
"""

import httpx

from app.integrations.base import (
    Connector, ConnectorError, ConnectorNotConfigured, ExternalRole, Subject,
    http_call, raise_for_status,
)
from app.integrations.secrets import resolve_secret

PATCH_OP = "urn:ietf:params:scim:api:messages:2.0:PatchOp"


class ScimConnector(Connector):
    name = "scim"

    def __init__(self, config: dict, secret_ref: str | None, client: httpx.AsyncClient):
        self.base_url = (config.get("base_url") or "").rstrip("/")
        if not self.base_url.startswith("https://") and not config.get("allow_http"):
            raise ConnectorNotConfigured("SCIM connector needs an https base_url")
        self.secret_ref = secret_ref
        self.client = client

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {resolve_secret(self.secret_ref)}",
            "Content-Type": "application/scim+json",
        }

    async def _user_id(self, subject: Subject) -> str:
        response = await http_call(
            self.client, "GET", f"{self.base_url}/Users", "Find SCIM user",
            headers=self._headers(), params={"filter": f'userName eq "{subject.email}"'},
        )
        raise_for_status(response, "Find SCIM user")
        resources = response.json().get("Resources", [])
        if not resources:
            raise ConnectorError(
                f"{subject.email} does not exist in the target application", transient=False
            )
        return resources[0]["id"]

    async def test_connection(self) -> None:
        response = await http_call(
            self.client, "GET", f"{self.base_url}/ServiceProviderConfig", "SCIM health",
            headers=self._headers(),
        )
        raise_for_status(response, "SCIM health")

    async def list_roles(self) -> list[ExternalRole]:
        response = await http_call(
            self.client, "GET", f"{self.base_url}/Groups", "List SCIM groups",
            headers=self._headers(), params={"attributes": "displayName"},
        )
        raise_for_status(response, "List SCIM groups")
        return [
            ExternalRole(external_id=g["id"], name=g.get("displayName") or g["id"])
            for g in response.json().get("Resources", [])
        ]

    async def get_user_roles(self, subject: Subject) -> set[str]:
        user_id = await self._user_id(subject)
        response = await http_call(
            self.client, "GET", f"{self.base_url}/Groups", "Read SCIM memberships",
            headers=self._headers(),
            params={"filter": f'members.value eq "{user_id}"', "attributes": "id"},
        )
        raise_for_status(response, "Read SCIM memberships")
        return {g["id"] for g in response.json().get("Resources", [])}

    async def _patch_group(self, group_id: str, operation: dict, action: str) -> None:
        response = await http_call(
            self.client, "PATCH", f"{self.base_url}/Groups/{group_id}", action,
            headers=self._headers(), json={"schemas": [PATCH_OP], "Operations": [operation]},
        )
        raise_for_status(response, action)

    async def grant(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None:
        if external_role_id in await self.get_user_roles(subject):
            return
        user_id = await self._user_id(subject)
        await self._patch_group(
            external_role_id, {"op": "add", "path": "members", "value": [{"value": user_id}]},
            "Add SCIM group member",
        )

    async def revoke(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None:
        if external_role_id not in await self.get_user_roles(subject):
            return
        user_id = await self._user_id(subject)
        await self._patch_group(
            external_role_id, {"op": "remove", "path": f'members[value eq "{user_id}"]'},
            "Remove SCIM group member",
        )
