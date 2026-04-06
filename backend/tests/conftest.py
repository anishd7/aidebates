import os

# Set test env vars BEFORE importing app modules
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://debate:debate_local@localhost:5432/debate_arena")
os.environ.setdefault("NEXTAUTH_SECRET", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0xMjM0NTY3ODkwYWI=")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base

TEST_DATABASE_URL = os.environ["DATABASE_URL"]


@pytest_asyncio.fixture
async def db_session():
    """Create tables in the local Postgres, yield a session, then drop tables."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
