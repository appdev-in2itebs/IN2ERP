"""
In2IT ERP - FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.database import async_session_factory, init_db
from app.db.seed import seed_database

# Import all models so SQLAlchemy sees them
from app.models import user, role, application, audit  # noqa: F401

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.roles import router as roles_router
from app.api.v1.applications import router as applications_router
from app.api.v1.assignments import router as assignments_router
from app.api.v1.audit import router as audit_router
from app.api.v1.dashboard import router as dashboard_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables & seed data. Shutdown: cleanup."""
    await init_db()
    async with async_session_factory() as session:
        await seed_database(session)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="In2IT Enterprise Resource Planning System API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
prefix = settings.API_V1_PREFIX
app.include_router(auth_router, prefix=prefix)
app.include_router(users_router, prefix=prefix)
app.include_router(roles_router, prefix=prefix)
app.include_router(applications_router, prefix=prefix)
app.include_router(assignments_router, prefix=prefix)
app.include_router(audit_router, prefix=prefix)
app.include_router(dashboard_router, prefix=prefix)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "env": settings.APP_ENV}
