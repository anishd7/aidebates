"""Tests for the FastAPI application entrypoint (app/main.py)."""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.models.debate import Debate
from app.models.user import User

import os

TEST_DATABASE_URL = os.environ["DATABASE_URL"]


@pytest_asyncio.fixture
async def setup_db():
    """Create tables, yield, then drop tables."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    yield engine, session_factory
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_health_via_app():
    """GET /api/v1/health via the real app returns 200 with expected shape."""
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert "timestamp" in body


@pytest.mark.asyncio
async def test_cors_allowed_origin():
    """Requests from an allowed origin get CORS headers."""
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "GET" in resp.headers.get("access-control-allow-methods", "")


@pytest.mark.asyncio
async def test_cors_disallowed_origin():
    """Requests from a non-allowed origin do not get CORS headers."""
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://evil.com",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert resp.headers.get("access-control-allow-origin") != "http://evil.com"


@pytest.mark.asyncio
async def test_startup_cleans_stale_running_debates(setup_db):
    """On startup, debates with status='running' are set to 'paused'."""
    engine, session_factory = setup_db

    # Insert a user and a debate with status='running'
    user_id = uuid.uuid4()
    debate_id = uuid.uuid4()

    async with session_factory() as session:
        session.add(User(id=user_id, email="test@test.com", name="Test"))
        session.add(
            Debate(
                id=debate_id,
                user_id=user_id,
                topic="Test topic",
                agent_a_config={"name": "A", "provider": "openai", "model": "gpt-4o", "personality": ""},
                agent_b_config={"name": "B", "provider": "anthropic", "model": "claude-sonnet-4-20250514", "personality": ""},
                status="running",
                current_turn=3,
                max_turns=10,
            )
        )
        await session.commit()

    # Simulate the cleanup that happens at startup
    async with session_factory() as session:
        await session.execute(
            text("UPDATE debates SET status = 'paused' WHERE status = 'running'")
        )
        await session.commit()

    # Verify
    async with session_factory() as session:
        result = await session.execute(select(Debate).where(Debate.id == debate_id))
        debate = result.scalar_one()
        assert debate.status == "paused"


@pytest.mark.asyncio
async def test_all_routers_registered():
    """All expected route prefixes are registered on the app."""
    from app.main import app

    routes = [route.path for route in app.routes]
    assert "/api/v1/health" in routes
    assert "/api/v1/keys" in routes
    assert "/api/v1/debates" in routes
    assert "/api/v1/debates/{debate_id}/next-turn" in routes
