"""
In2IT ERP - Connector secret resolution

The database stores only the *name* of a secret, never its value. Values are read from
the process environment. On Azure App Service, Key Vault references
(`@Microsoft.KeyVault(SecretUri=...)`) surface Key Vault secrets as environment
variables, so the same lookup works locally and in production.
"""

import os
import re

from app.integrations.base import ConnectorNotConfigured

SECRET_REF_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]{2,127}$")


def is_valid_secret_ref(ref: str) -> bool:
    return bool(SECRET_REF_PATTERN.match(ref))


def resolve_secret(ref: str | None) -> str:
    if not ref:
        raise ConnectorNotConfigured("No credential reference is configured")
    if not is_valid_secret_ref(ref):
        raise ConnectorNotConfigured("Credential reference must be an environment variable name")
    value = os.environ.get(ref)
    if not value:
        raise ConnectorNotConfigured(f"Credential '{ref}' is not available to the server")
    return value
