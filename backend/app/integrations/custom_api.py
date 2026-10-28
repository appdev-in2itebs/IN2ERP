"""
In2IT ERP - Custom API connector (In2ERP provisioning contract)

For applications that keep roles in their own RBAC and expose the small HTTP contract
documented in docs/application-integration.md. The target application is the system of
record for role membership.

Configuration (applications.connector_config):
    {"base_url": "https://app.example.com/in2erp/v1"}
Credentials: bearer token named by connector_secret_ref.

Contract (all JSON, bearer-authenticated):
    GET    {base}/health                           -> 200
    GET    {base}/roles                            -> {"roles": [{"id", "name", "description"}]}
    GET    {base}/users/{email}/roles              -> {"roles": ["<role id>", ...]}
    PUT    {base}/users/{email}/roles/{role_id}    -> 200/201/204 (idempotent grant)
    DELETE {base}/users/{email}/roles/{role_id}    -> 200/204/404 (idempotent revoke)
Requests carry `Idempotency-Key` and, when known, `X-Entra-Object-Id`.
"""

from urllib.parse import quote

import httpx

from app.integrations.base import (
    Connector, ConnectorNotConfigured, ExternalRole, Subject, http_call, raise_for_status,
)
from app.integrations.secrets import resolve_secret


class CustomApiConnector(Connector):
    name = "custom_api"

    def __init__(self, config: dict, secret_ref: str | None, client: httpx.AsyncClient):
        self.base_url = (config.get("base_url") or "").rstrip("/")
        if not self.base_url.startswith("https://") and not config.get("allow_http"):
            raise ConnectorNotConfigured("Custom API connector needs an https base_url")
        self.secret_ref = secret_ref
        self.client = client

    def _headers(self, subject: Subject | None = None, idempotency_key: str | None = None) -> dict:
        headers = {"Authorization": f"Bearer {resolve_secret(self.secret_ref)}"}
        if subject and subject.entra_object_id:
            headers["X-Entra-Object-Id"] = subject.entra_object_id
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return headers

    def _user_url(self, subject: Subject) -> str:
        return f"{self.base_url}/users/{quote(subject.email, safe='')}/roles"

    async def test_connection(self) -> None:
        response = await http_call(self.client, "GET", f"{self.base_url}/health", "Health check",
                                   headers=self._headers())
        raise_for_status(response, "Health check")

    async def list_roles(self) -> list[ExternalRole]:
        response = await http_call(self.client, "GET", f"{self.base_url}/roles", "List roles",
                                   headers=self._headers())
        raise_for_status(response, "List roles")
        return [
            ExternalRole(external_id=str(r["id"]), name=r["name"], description=r.get("description"))
            for r in response.json().get("roles", [])
        ]

    async def get_user_roles(self, subject: Subject) -> set[str]:
        response = await http_call(self.client, "GET", self._user_url(subject), "Read user roles",
                                   headers=self._headers(subject))
        if response.status_code == 404:
            return set()
        raise_for_status(response, "Read user roles")
        return {str(r) for r in response.json().get("roles", [])}

    async def grant(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None:
        response = await http_call(
            self.client, "PUT", f"{self._user_url(subject)}/{quote(external_role_id, safe='')}",
            "Grant role", headers=self._headers(subject, idempotency_key),
        )
        raise_for_status(response, "Grant role")

    async def revoke(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None:
        response = await http_call(
            self.client, "DELETE", f"{self._user_url(subject)}/{quote(external_role_id, safe='')}",
            "Revoke role", headers=self._headers(subject, idempotency_key),
        )
        if response.status_code == 404:
            return
        raise_for_status(response, "Revoke role")
