"""
In2IT ERP - Request Context
Captures client IP, user agent and a correlation ID per request so audit entries
and provisioning jobs can record them without threading the Request object through
every service. The correlation ID is returned to the client as X-Request-ID.
"""

import re
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import get_settings

client_ip_var: ContextVar[str | None] = ContextVar("client_ip", default=None)
user_agent_var: ContextVar[str | None] = ContextVar("user_agent", default=None)
correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


class RequestContextMiddleware:
    """Pure ASGI middleware that populates the request context variables."""

    def __init__(self, app: ASGIApp):
        self.app = app
        self.trust_proxy = get_settings().TRUST_PROXY_HEADERS

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        ip = scope["client"][0] if scope.get("client") else None
        if self.trust_proxy and headers.get("x-forwarded-for"):
            ip = headers["x-forwarded-for"].split(",")[0].strip()

        incoming = headers.get("x-request-id", "")
        correlation_id = incoming if _SAFE_REQUEST_ID.match(incoming) else uuid.uuid4().hex

        tokens = (
            client_ip_var.set(ip),
            user_agent_var.set((headers.get("user-agent") or "")[:500] or None),
            correlation_id_var.set(correlation_id),
        )

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                message["headers"].append((b"x-request-id", correlation_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            for var, token in zip((client_ip_var, user_agent_var, correlation_id_var), tokens, strict=True):
                var.reset(token)
