"""
In2IT ERP - FastAPI Application Entry Point
"""

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.request_context import RequestContextMiddleware
from app.db.database import async_session_factory
from app.db.seed import seed_database
from app.services.provisioning_service import run_worker

# Import all models so SQLAlchemy sees them
from app.models import user, role, application, audit, provisioning, session  # noqa: F401

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.roles import router as roles_router
from app.api.v1.applications import router as applications_router
from app.api.v1.assignments import provisioning_router, router as assignments_router
from app.api.v1.audit import router as audit_router
from app.api.v1.dashboard import router as dashboard_router

settings = get_settings()
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: seed an empty database (outside production by default) and start the
    provisioning worker. The schema itself is managed by Alembic: `alembic upgrade head`.
    """
    if settings.seed_on_startup:
        async with async_session_factory() as session:
            await seed_database(session)

    worker = None
    if settings.PROVISIONING_WORKER_ENABLED:
        worker = asyncio.create_task(
            run_worker(async_session_factory, settings.PROVISIONING_POLL_SECONDS)
        )
    yield
    if worker:
        worker.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker


app = FastAPI(
    title=settings.APP_NAME,
    description="In2IT Enterprise Resource Planning System API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.api_docs_enabled else None,
    redoc_url="/redoc" if settings.api_docs_enabled else None,
    openapi_url="/openapi.json" if settings.api_docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(RequestContextMiddleware)

# Register API routes
prefix = settings.API_V1_PREFIX
app.include_router(auth_router, prefix=prefix)
app.include_router(users_router, prefix=prefix)
app.include_router(roles_router, prefix=prefix)
app.include_router(applications_router, prefix=prefix)
app.include_router(assignments_router, prefix=prefix)
app.include_router(provisioning_router, prefix=prefix)
app.include_router(audit_router, prefix=prefix)
app.include_router(dashboard_router, prefix=prefix)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}
