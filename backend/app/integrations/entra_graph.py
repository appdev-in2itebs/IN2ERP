"""
In2IT ERP - Microsoft Entra app-role connector (Microsoft Graph)

Use when the target application enforces roles from the `roles` claim of Entra tokens,
i.e. its roles are defined as app roles on its Entra app registration. Entra is then the
system of record for role membership.

Configuration (applications.connector_config):
    {"service_principal_id": "<object id of the app's enterprise application>"}
Role catalogue: AppRole.external_role_id = the Entra app role id (GUID).
Credentials: client-credentials grant for GRAPH_CLIENT_ID with the secret named by
connector_secret_ref (default GRAPH_CLIENT_SECRET_REF). Required Graph application
permission: AppRoleAssignment.ReadWrite.All (admin consent) — the narrowest Graph
permission that can write app-role assignments.
"""

import time

import httpx

from app.core.config import get_settings
from app.integrations.base import (
    Connector, ConnectorError, ConnectorNotConfigured, ExternalRole, Subject,
    http_call, raise_for_status,
)
from app.integrations.secrets import resolve_secret

GRAPH = "https://graph.microsoft.com/v1.0"
LOGIN = "https://login.microsoftonline.com"


class EntraAppRoleConnector(Connector):
    name = "entra_app_roles"

    def __init__(self, config: dict, secret_ref: str | None, client: httpx.AsyncClient):
        settings = get_settings()
        self.service_principal_id = config.get("service_principal_id")
        self.tenant_id = config.get("tenant_id") or settings.ENTRA_TENANT_ID
        self.client_id = config.get("client_id") or settings.GRAPH_CLIENT_ID
        self.secret_ref = secret_ref or settings.GRAPH_CLIENT_SECRET_REF
        self.client = client
        self._token: str | None = None
        self._token_expiry = 0.0
        if not (self.service_principal_id and self.tenant_id and self.client_id):
            raise ConnectorNotConfigured(
                "Entra connector needs service_principal_id, ENTRA_TENANT_ID and GRAPH_CLIENT_ID"
            )

    async def _headers(self) -> dict:
        if not self._token or time.monotonic() > self._token_expiry:
            response = await http_call(
                self.client, "POST", f"{LOGIN}/{self.tenant_id}/oauth2/v2.0/token",
                "Graph token request",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": resolve_secret(self.secret_ref),
                    "scope": "https://graph.microsoft.com/.default",
                },
            )
            raise_for_status(response, "Graph token request")
            body = response.json()
            self._token = body["access_token"]
            self._token_expiry = time.monotonic() + int(body.get("expires_in", 3600)) - 120
        return {"Authorization": f"Bearer {self._token}"}

    def _object_id(self, subject: Subject) -> str:
        if not subject.entra_object_id:
            raise ConnectorError("Employee is not linked to an Entra account", transient=False)
        return subject.entra_object_id

    async def _assignments(self, subject: Subject) -> dict[str, str]:
        """appRoleId -> assignment id for this subject on this application."""
        oid = self._object_id(subject)
        response = await http_call(
            self.client, "GET", f"{GRAPH}/users/{oid}/appRoleAssignments",
            "Read app-role assignments", headers=await self._headers(),
            params={"$filter": f"resourceId eq {self.service_principal_id}"},
        )
        raise_for_status(response, "Read app-role assignments")
        return {a["appRoleId"].lower(): a["id"] for a in response.json().get("value", [])}

    async def test_connection(self) -> None:
        response = await http_call(
            self.client, "GET", f"{GRAPH}/servicePrincipals/{self.service_principal_id}",
            "Read service principal", headers=await self._headers(),
            params={"$select": "id,displayName"},
        )
        raise_for_status(response, "Read service principal")

    async def list_roles(self) -> list[ExternalRole]:
        response = await http_call(
            self.client, "GET", f"{GRAPH}/servicePrincipals/{self.service_principal_id}",
            "Read app roles", headers=await self._headers(), params={"$select": "appRoles"},
        )
        raise_for_status(response, "Read app roles")
        return [
            ExternalRole(external_id=r["id"].lower(), name=r["displayName"],
                         description=r.get("description"))
            for r in response.json().get("appRoles", [])
            if r.get("isEnabled", True) and "User" in r.get("allowedMemberTypes", ["User"])
        ]

    async def get_user_roles(self, subject: Subject) -> set[str]:
        return set(await self._assignments(subject))

    async def grant(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None:
        if external_role_id.lower() in await self._assignments(subject):
            return  # already held
        response = await http_call(
            self.client, "POST",
            f"{GRAPH}/servicePrincipals/{self.service_principal_id}/appRoleAssignedTo",
            "Assign app role", headers=await self._headers(),
            json={
                "principalId": self._object_id(subject),
                "resourceId": self.service_principal_id,
                "appRoleId": external_role_id,
            },
        )
        if response.status_code == 409:
            return  # a concurrent attempt already created it
        raise_for_status(response, "Assign app role")

    async def revoke(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None:
        assignment_id = (await self._assignments(subject)).get(external_role_id.lower())
        if not assignment_id:
            return  # not held
        response = await http_call(
            self.client, "DELETE",
            f"{GRAPH}/servicePrincipals/{self.service_principal_id}/appRoleAssignedTo/{assignment_id}",
            "Remove app role", headers=await self._headers(),
        )
        if response.status_code == 404:
            return
        raise_for_status(response, "Remove app role")
