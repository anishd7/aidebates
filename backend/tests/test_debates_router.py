"""Tests for the debate CRUD endpoints (POST, GET list, GET detail)."""

import os
import time
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.middleware.auth import ALGORITHM
from app.models.api_key import UserApiKey
from app.models.debate import Debate
from app.models.turn import Turn
from app.routers.debates import router as debates_router
from app.routers.keys import router as keys_router
from app.services.encryption import encrypt_key, get_key_last_four
from fastapi import FastAPI

SECRET = os.environ["NEXTAUTH_SECRET"]
TEST_DATABASE_URL = os.environ["DATABASE_URL"]


def _make_token(email: str = "debate@example.com") -> str:
    now = int(time.time())
    payload = {
        "sub": email,
        "email": email,
        "name": "Debate User",
        "picture": "https://example.com/avatar.png",
        "iat": now,
        "exp": now + 3600,
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {_make_token()}"}


@pytest.fixture
def auth_headers_other():
    return {"Authorization": f"Bearer {_make_token(email='other@example.com')}"}


@pytest_asyncio.fixture
async def app_with_db():
    """Create a FastAPI app with debates + keys routers and a fresh database."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app = FastAPI()
    app.include_router(debates_router, prefix="/api/v1")
    app.include_router(keys_router, prefix="/api/v1")
    app.dependency_overrides[get_db] = override_get_db

    yield app, session_factory

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _setup_keys(client, auth_headers, providers=("openai", "anthropic")):
    """Helper: save API keys for the given providers."""
    for provider in providers:
        await client.post(
            "/api/v1/keys",
            json={"provider": provider, "api_key": f"sk-test-{provider}-1234"},
            headers=auth_headers,
        )


def _valid_create_body(**overrides):
    """Return a valid CreateDebateRequest body with optional overrides."""
    body = {
        "topic": "Should AI be open source?",
        "agent_a": {
            "name": "Pro AI",
            "personality": "Enthusiastic advocate for open-source AI.",
            "provider": "openai",
            "model": "gpt-4o",
        },
        "agent_b": {
            "name": "Skeptic",
            "personality": "Critical thinker who questions everything.",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
        },
        "max_turns": 6,
    }
    body.update(overrides)
    return body


# --- POST /api/v1/debates ---


@pytest.mark.asyncio
async def test_create_debate_success(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        resp = await client.post("/api/v1/debates", json=_valid_create_body(), headers=auth_headers)

    assert resp.status_code == 201
    body = resp.json()
    assert body["topic"] == "Should AI be open source?"
    assert body["status"] == "created"
    assert body["current_turn"] == 0
    assert body["max_turns"] == 6
    assert body["turns"] == []
    assert body["agent_a_config"]["name"] == "Pro AI"
    assert body["agent_b_config"]["name"] == "Skeptic"
    # ID should be a valid UUID
    uuid.UUID(body["id"])


@pytest.mark.asyncio
async def test_create_debate_missing_provider_key(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Only save openai key, not anthropic
        await _setup_keys(client, auth_headers, providers=("openai",))
        resp = await client.post("/api/v1/debates", json=_valid_create_body(), headers=auth_headers)

    assert resp.status_code == 400
    assert "anthropic" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_debate_same_provider_both_agents(app_with_db, auth_headers):
    """When both agents use the same provider, only that one key is needed."""
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers, providers=("openai",))
        body = _valid_create_body()
        body["agent_b"]["provider"] = "openai"
        body["agent_b"]["model"] = "gpt-4o-mini"
        resp = await client.post("/api/v1/debates", json=body, headers=auth_headers)

    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_create_debate_missing_topic(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        body = _valid_create_body()
        body.pop("topic")
        resp = await client.post("/api/v1/debates", json=body, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_debate_invalid_max_turns_zero(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        resp = await client.post(
            "/api/v1/debates", json=_valid_create_body(max_turns=0), headers=auth_headers
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_debate_invalid_max_turns_over_100(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        resp = await client.post(
            "/api/v1/debates", json=_valid_create_body(max_turns=101), headers=auth_headers
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_debate_invalid_provider(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        body = _valid_create_body()
        body["agent_a"]["provider"] = "google"
        resp = await client.post("/api/v1/debates", json=body, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_debate_no_auth(app_with_db):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/debates", json=_valid_create_body())
    assert resp.status_code == 422  # Missing Authorization header


# --- GET /api/v1/debates ---


@pytest.mark.asyncio
async def test_list_debates_returns_user_debates(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        # Create two debates
        await client.post("/api/v1/debates", json=_valid_create_body(topic="Debate 1"), headers=auth_headers)
        await client.post("/api/v1/debates", json=_valid_create_body(topic="Debate 2"), headers=auth_headers)

        resp = await client.get("/api/v1/debates", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert len(body["debates"]) == 2
    # Most recent first
    assert body["debates"][0]["topic"] == "Debate 2"
    assert body["debates"][1]["topic"] == "Debate 1"
    # Check agent names extracted from config
    assert body["debates"][0]["agent_a_name"] == "Pro AI"
    assert body["debates"][0]["agent_b_name"] == "Skeptic"


@pytest.mark.asyncio
async def test_list_debates_with_status_filter(app_with_db, auth_headers):
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        # Create a debate (status=created)
        resp = await client.post(
            "/api/v1/debates", json=_valid_create_body(topic="Created"), headers=auth_headers
        )
        debate_id = resp.json()["id"]

        # Manually set one debate to completed
        async with sf() as session:
            from sqlalchemy import update
            await session.execute(
                update(Debate).where(Debate.id == uuid.UUID(debate_id)).values(status="completed")
            )
            await session.commit()

        # Create another debate that stays as 'created'
        await client.post(
            "/api/v1/debates", json=_valid_create_body(topic="Still Created"), headers=auth_headers
        )

        resp_completed = await client.get("/api/v1/debates?status=completed", headers=auth_headers)
        resp_created = await client.get("/api/v1/debates?status=created", headers=auth_headers)

    assert resp_completed.status_code == 200
    assert resp_completed.json()["total"] == 1
    assert resp_completed.json()["debates"][0]["topic"] == "Created"

    assert resp_created.status_code == 200
    assert resp_created.json()["total"] == 1
    assert resp_created.json()["debates"][0]["topic"] == "Still Created"


@pytest.mark.asyncio
async def test_list_debates_pagination(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        for i in range(5):
            await client.post(
                "/api/v1/debates", json=_valid_create_body(topic=f"Debate {i}"), headers=auth_headers
            )

        resp = await client.get("/api/v1/debates?limit=2&offset=1", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 5
    assert body["limit"] == 2
    assert body["offset"] == 1
    assert len(body["debates"]) == 2


@pytest.mark.asyncio
async def test_list_debates_empty(app_with_db, auth_headers):
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/debates", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["debates"] == []
    assert resp.json()["total"] == 0


# --- GET /api/v1/debates/{id} ---


@pytest.mark.asyncio
async def test_get_own_debate_with_turns(app_with_db, auth_headers):
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        create_resp = await client.post(
            "/api/v1/debates", json=_valid_create_body(), headers=auth_headers
        )
        debate_id = create_resp.json()["id"]

        # Insert a turn directly in the database
        async with sf() as session:
            turn = Turn(
                id=uuid.uuid4(),
                debate_id=uuid.UUID(debate_id),
                turn_number=1,
                agent_name="Pro AI",
                agent_side="A",
                content="I believe AI should be open source.",
                model_used="gpt-4o",
            )
            session.add(turn)
            await session.commit()

        resp = await client.get(f"/api/v1/debates/{debate_id}", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == debate_id
    assert len(body["turns"]) == 1
    assert body["turns"][0]["turn_number"] == 1
    assert body["turns"][0]["agent_name"] == "Pro AI"


@pytest.mark.asyncio
async def test_get_shared_completed_debate_no_auth(app_with_db, auth_headers):
    """Unauthenticated users can view completed debates (public sharing)."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        create_resp = await client.post(
            "/api/v1/debates", json=_valid_create_body(), headers=auth_headers
        )
        debate_id = create_resp.json()["id"]

        # Mark debate as completed
        async with sf() as session:
            from sqlalchemy import update
            await session.execute(
                update(Debate).where(Debate.id == uuid.UUID(debate_id)).values(status="completed")
            )
            await session.commit()

        # No auth headers
        resp = await client.get(f"/api/v1/debates/{debate_id}")

    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_get_private_debate_no_auth_returns_404(app_with_db, auth_headers):
    """Unauthenticated request for a non-completed debate returns 404."""
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        create_resp = await client.post(
            "/api/v1/debates", json=_valid_create_body(), headers=auth_headers
        )
        debate_id = create_resp.json()["id"]

        # No auth headers — debate is still 'created' (not completed)
        resp = await client.get(f"/api/v1/debates/{debate_id}")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_nonexistent_debate_returns_404(app_with_db, auth_headers):
    app, _ = app_with_db
    fake_id = str(uuid.uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/v1/debates/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_user_isolation_list(app_with_db, auth_headers, auth_headers_other):
    """User A's debates do not appear in User B's list."""
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # User A sets up keys and creates a debate
        await _setup_keys(client, auth_headers)
        await client.post("/api/v1/debates", json=_valid_create_body(), headers=auth_headers)

        # User B sets up keys
        await _setup_keys(client, auth_headers_other)

        # User B should see no debates
        resp = await client.get("/api/v1/debates", headers=auth_headers_other)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_user_isolation_get_by_id(app_with_db, auth_headers, auth_headers_other):
    """User B cannot access User A's non-completed debate by ID."""
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _setup_keys(client, auth_headers)
        create_resp = await client.post(
            "/api/v1/debates", json=_valid_create_body(), headers=auth_headers
        )
        debate_id = create_resp.json()["id"]

        # User B tries to get User A's debate (status=created, not completed)
        resp = await client.get(f"/api/v1/debates/{debate_id}", headers=auth_headers_other)
    assert resp.status_code == 404
