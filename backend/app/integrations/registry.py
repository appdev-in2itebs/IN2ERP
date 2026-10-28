"""
In2IT ERP - Connector registry
Builds the connector for an application from its integration type and configuration.
"""

import httpx

from app.core.config import get_settings
from app.integrations.base import Connector, ConnectorNotConfigured
from app.integrations.custom_api import CustomApiConnector
from app.integrations.entra_graph import EntraAppRoleConnector
from app.integrations.manual import ManualConnector
from app.integrations.scim import ScimConnector
from app.models.application import Application

CONNECTORS = {
    "entra_app_roles": EntraAppRoleConnector,
    "scim": ScimConnector,
    "custom_api": CustomApiConnector,
}

# Tests replace this to route connector HTTP calls to a mock transport.
_transport: httpx.AsyncBaseTransport | None = None


def set_http_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    global _transport
    _transport = transport


def http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=get_settings().CONNECTOR_TIMEOUT_SECONDS, transport=_transport,
        follow_redirects=False,
    )


def build_connector(app: Application, client: httpx.AsyncClient | None) -> Connector:
    """Raises ConnectorNotConfigured when the application cannot be integrated yet.
    Connectors only use `client` when an operation runs, so None is fine for config checks."""
    if app.integration_type == "manual":
        return ManualConnector()
    connector_cls = CONNECTORS.get(app.integration_type)
    if not connector_cls:
        raise ConnectorNotConfigured(f"Unknown integration type '{app.integration_type}'")
    return connector_cls(app.config, app.connector_secret_ref, client)


def configuration_status(app: Application) -> str:
    """Static check of whether the connector has the settings it needs."""
    if app.integration_type == "manual":
        return "manual"
    try:
        build_connector(app, None)
    except ConnectorNotConfigured:
        return "unconfigured"
    if not app.connector_secret_ref and app.integration_type != "entra_app_roles":
        return "unconfigured"
    return "configured"
