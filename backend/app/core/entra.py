"""
In2IT ERP - Microsoft Entra ID access-token validation

The SPA signs users in with MSAL (authorization code + PKCE) and calls this API with an
Entra *access token* issued for the In2ERP API registration. This module validates it:

- RS256 signature against the tenant's published signing keys (JWKS)
- audience is the In2ERP API (never the SPA client, so ID tokens are rejected)
- issuer and tenant (`tid`) belong to an allowed tenant
- expiry / not-before
- a delegated scope (`scp`) containing ENTRA_API_SCOPE, so app-only tokens are rejected
- the object ID (`oid`) is present: employees are identified by tenant + object ID
"""

import asyncio
from dataclasses import dataclass, field

import jwt
from jwt import PyJWKClient

from app.core.config import Settings

ENTRA_AUTHORITY = "https://login.microsoftonline.com"


class EntraTokenError(Exception):
    """The bearer token is not an acceptable Entra access token for this API."""


@dataclass
class EntraIdentity:
    tenant_id: str
    object_id: str
    email: str | None
    name: str | None
    given_name: str | None = None
    family_name: str | None = None
    roles: list[str] = field(default_factory=list)
    scopes: list[str] = field(default_factory=list)


def looks_like_entra_token(token: str) -> bool:
    """Entra tokens are RS256-signed; local ERP tokens are HMAC-signed."""
    try:
        return jwt.get_unverified_header(token).get("alg") == "RS256"
    except jwt.PyJWTError:
        return False


class EntraTokenValidator:
    def __init__(self, settings: Settings, jwks_client: PyJWKClient | None = None):
        self.settings = settings
        tenants = settings.entra_allowed_tenants
        key_tenant = tenants[0] if len(tenants) == 1 else "common"
        self.jwks_client = jwks_client or PyJWKClient(
            f"{ENTRA_AUTHORITY}/{key_tenant}/discovery/v2.0/keys", cache_keys=True, lifespan=3600
        )

    def _audiences(self) -> list[str]:
        audiences = [self.settings.entra_audience]
        if self.settings.ENTRA_API_CLIENT_ID:
            audiences.append(self.settings.ENTRA_API_CLIENT_ID)  # v2 tokens use the client ID
        return [a for a in audiences if a]

    def validate_sync(self, token: str) -> EntraIdentity:
        if not self.settings.entra_enabled:
            raise EntraTokenError("Entra sign-in is not configured")
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") != "RS256":
                raise EntraTokenError("Unsupported token algorithm")
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self._audiences(),
                options={"require": ["exp", "iat", "iss", "aud", "tid", "oid"]},
                leeway=60,
            )
        except EntraTokenError:
            raise
        except jwt.PyJWTError as exc:
            raise EntraTokenError(f"Invalid Entra token: {exc}") from exc

        tenant_id = str(claims["tid"]).lower()
        if tenant_id not in self.settings.entra_allowed_tenants:
            raise EntraTokenError("Tenant is not allowed")

        valid_issuers = {
            f"{ENTRA_AUTHORITY}/{tenant_id}/v2.0",
            f"https://sts.windows.net/{tenant_id}/",
        }
        if str(claims["iss"]).lower() not in valid_issuers:
            raise EntraTokenError("Unexpected token issuer")

        if self.settings.ENTRA_SPA_CLIENT_ID and claims.get("aud") == self.settings.ENTRA_SPA_CLIENT_ID:
            raise EntraTokenError("ID tokens are not accepted")

        scopes = str(claims.get("scp", "")).split()
        if self.settings.ENTRA_API_SCOPE not in scopes:
            raise EntraTokenError("Token lacks the required delegated scope")

        email = claims.get("email") or claims.get("preferred_username") or claims.get("upn")
        return EntraIdentity(
            tenant_id=tenant_id,
            object_id=str(claims["oid"]).lower(),
            email=email.lower() if email else None,
            name=claims.get("name"),
            given_name=claims.get("given_name"),
            family_name=claims.get("family_name"),
            roles=list(claims.get("roles", [])),
            scopes=scopes,
        )

    async def validate(self, token: str) -> EntraIdentity:
        # PyJWKClient fetches keys with blocking I/O; keep the event loop free.
        return await asyncio.to_thread(self.validate_sync, token)


_validator: EntraTokenValidator | None = None


def get_entra_validator(settings: Settings) -> EntraTokenValidator:
    global _validator
    if _validator is None:
        _validator = EntraTokenValidator(settings)
    return _validator


def set_entra_validator(validator: EntraTokenValidator | None) -> None:
    """Test hook: inject a validator backed by a local key set."""
    global _validator
    _validator = validator
