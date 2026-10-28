"""
In2IT ERP - Database Configuration
Async SQLAlchemy engine setup. Works with both SQLite and PostgreSQL.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# Engine configuration adapts based on database type
engine_kwargs = {}
if settings.is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQL_ECHO,
    **engine_kwargs,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency that yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_session_factory() -> async_sessionmaker:
    """Dependency for code that manages its own sessions (e.g. the provisioning worker)."""
    return async_session_factory


async def init_db():
    """Create all tables directly from the models (tests only; use Alembic otherwise)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
