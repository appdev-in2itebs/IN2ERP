"""
In2IT ERP - Application connector interface

A connector applies access decisions made in the ERP to one target application and
reports what the target actually holds. Every operation is safe to retry: granting a
role the user already has, or revoking one they do not have, succeeds without change.

Ownership: the target application (or Entra, for the Entra connector) is the system of
record for whether a role is held. The ERP records intent and the last observed state.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class ExternalRole:
    external_id: str
    name: str
    description: str | None = None


@dataclass(frozen=True)
class Subject:
    """The employee as the connector needs to identify them in the target system."""
    user_id: str
    email: str
    entra_object_id: str | None = None


class ConnectorError(Exception):
    """A connector operation failed. `transient` errors are retried; others are not."""

    def __init__(self, message: str, *, transient: bool = False):
        super().__init__(message)
        self.transient = transient


class ConnectorNotConfigured(ConnectorError):
    """The application has no usable connector configuration."""


class ManualActionRequired(Exception):
    """The application has no connector: an app owner must apply the change and confirm it."""


class Connector(ABC):
    name = "connector"

    @abstractmethod
    async def test_connection(self) -> None: ...

    @abstractmethod
    async def list_roles(self) -> list[ExternalRole]: ...

    @abstractmethod
    async def get_user_roles(self, subject: Subject) -> set[str]:
        """External IDs of the roles the subject currently holds in the target."""

    @abstractmethod
    async def grant(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None: ...

    @abstractmethod
    async def revoke(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None: ...

    async def verify(self, subject: Subject, external_role_id: str, expect_present: bool) -> bool:
        """Read back from the target whether the role is (or is not) held as expected."""
        held = await self.get_user_roles(subject)
        return (external_role_id in held) == expect_present


def raise_for_status(response: httpx.Response, action: str) -> None:
    """Translate HTTP failures into connector errors with retry classification."""
    if response.is_success:
        return
    transient = response.status_code == 429 or response.status_code >= 500
    body = response.text[:300] if response.text else ""
    raise ConnectorError(
        f"{action} failed: HTTP {response.status_code} {body}".strip(), transient=transient
    )


async def http_call(client: httpx.AsyncClient, method: str, url: str, action: str, **kwargs) -> httpx.Response:
    try:
        return await client.request(method, url, **kwargs)
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        raise ConnectorError(f"{action} failed: {exc.__class__.__name__}", transient=True) from exc
