"""Tests for the next-turn endpoint (POST /api/v1/debates/{id}/next-turn)."""

import json
import os
import time
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from openai.types.responses import ResponseTextDeltaEvent
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.middleware.auth import ALGORITHM
from app.models.api_key import UserApiKey
from app.models.debate import Debate
from app.models.turn import Turn
from app.routers.debates import router as debates_router
from app.routers.keys import router as keys_router
from app.routers.turns import router as turns_router
from app.services.encryption import encrypt_key

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
    """Create a FastAPI app with debates + keys + turns routers and a fresh database."""
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
    app.include_router(turns_router, prefix="/api/v1")
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


def _make_delta_event(delta_text: str):
    """Create a mock that passes isinstance(obj, ResponseTextDeltaEvent)."""
    mock = MagicMock(spec=ResponseTextDeltaEvent)
    mock.delta = delta_text
    return mock


def _mock_streamed_result(chunks: list[str]):
    """Build a mock Runner.run_streamed result that yields text delta events."""

    async def stream_events():
        for chunk in chunks:
            yield SimpleNamespace(
                type="raw_response_event",
                data=_make_delta_event(chunk),
            )

    result = MagicMock()
    result.stream_events = stream_events
    result.new_items = []
    return result


async def _create_debate(client, auth_headers) -> str:
    """Helper: create a debate and return its ID."""
    await _setup_keys(client, auth_headers)
    resp = await client.post(
        "/api/v1/debates", json=_valid_create_body(), headers=auth_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _parse_sse_events(text: str) -> list[dict]:
    """Parse SSE text into a list of {event, data} dicts."""
    events = []
    current_event = None
    current_data = None

    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            current_data = line[len("data:"):].strip()
        elif line == "" and current_event is not None and current_data is not None:
            try:
                data = json.loads(current_data)
            except json.JSONDecodeError:
                data = current_data
            events.append({"event": current_event, "data": data})
            current_event = None
            current_data = None

    # Handle last event if no trailing newline
    if current_event is not None and current_data is not None:
        try:
            data = json.loads(current_data)
        except json.JSONDecodeError:
            data = current_data
        events.append({"event": current_event, "data": data})

    return events


# --- POST /api/v1/debates/{id}/next-turn ---


@pytest.mark.asyncio
async def test_next_turn_happy_path(app_with_db, auth_headers):
    """Generate first turn: should stream turn_start, tokens, turn_complete."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=_mock_streamed_result(["Hello ", "world."]),
        ), patch("app.services.debate_orchestrator.create_agent"):
            resp = await client.post(
                f"/api/v1/debates/{debate_id}/next-turn",
                headers=auth_headers,
            )

    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)

    event_types = [e["event"] for e in events]
    assert "turn_start" in event_types
    assert "token" in event_types
    assert "turn_complete" in event_types

    # Verify turn_start data
    start = next(e for e in events if e["event"] == "turn_start")
    assert start["data"]["turn"] == 0
    assert start["data"]["agent_name"] == "Pro AI"
    assert start["data"]["agent_side"] == "a"

    # Verify turn_complete data
    complete = next(e for e in events if e["event"] == "turn_complete")
    assert complete["data"]["content"] == "Hello world."
    assert complete["data"]["current_turn"] == 1

    # Verify DB state
    async with sf() as session:
        debate = (
            await session.execute(select(Debate).where(Debate.id == uuid.UUID(debate_id)))
        ).scalar_one()
        assert debate.current_turn == 1
        assert debate.status == "running"

        turn = (
            await session.execute(select(Turn).where(Turn.debate_id == uuid.UUID(debate_id)))
        ).scalar_one()
        assert turn.turn_number == 0
        assert turn.agent_name == "Pro AI"
        assert turn.agent_side == "a"
        assert turn.content == "Hello world."


@pytest.mark.asyncio
async def test_next_turn_second_turn_uses_agent_b(app_with_db, auth_headers):
    """Turn 1 (odd) should use agent_b (Skeptic / anthropic)."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        # Manually insert turn 0 and advance current_turn
        async with sf() as session:
            await session.execute(
                update(Debate)
                .where(Debate.id == uuid.UUID(debate_id))
                .values(current_turn=1, status="running")
            )
            session.add(Turn(
                debate_id=uuid.UUID(debate_id),
                turn_number=0,
                agent_name="Pro AI",
                agent_side="a",
                content="Opening argument.",
                model_used="gpt-4o",
            ))
            await session.commit()

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=_mock_streamed_result(["Counterpoint."]),
        ), patch("app.services.debate_orchestrator.create_agent"):
            resp = await client.post(
                f"/api/v1/debates/{debate_id}/next-turn",
                headers=auth_headers,
            )

    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    start = next(e for e in events if e["event"] == "turn_start")
    assert start["data"]["agent_name"] == "Skeptic"
    assert start["data"]["agent_side"] == "b"


@pytest.mark.asyncio
async def test_next_turn_debate_not_found(app_with_db, auth_headers):
    app, _ = app_with_db
    fake_id = str(uuid.uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/debates/{fake_id}/next-turn",
            headers=auth_headers,
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_next_turn_other_user_404(app_with_db, auth_headers, auth_headers_other):
    """User B cannot trigger turns on User A's debate."""
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        resp = await client.post(
            f"/api/v1/debates/{debate_id}/next-turn",
            headers=auth_headers_other,
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_next_turn_debate_already_complete(app_with_db, auth_headers):
    """If current_turn >= max_turns, return 204 and mark completed."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        async with sf() as session:
            await session.execute(
                update(Debate)
                .where(Debate.id == uuid.UUID(debate_id))
                .values(current_turn=6, max_turns=6, status="running")
            )
            await session.commit()

        resp = await client.post(
            f"/api/v1/debates/{debate_id}/next-turn",
            headers=auth_headers,
        )

    assert resp.status_code == 204

    # Verify status set to completed
    async with sf() as session:
        debate = (
            await session.execute(select(Debate).where(Debate.id == uuid.UUID(debate_id)))
        ).scalar_one()
        assert debate.status == "completed"


@pytest.mark.asyncio
async def test_next_turn_duplicate_turn_409(app_with_db, auth_headers):
    """If the turn already exists in DB, return 409."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        # Insert turn 0 but leave current_turn at 0 (simulating race)
        async with sf() as session:
            session.add(Turn(
                debate_id=uuid.UUID(debate_id),
                turn_number=0,
                agent_name="Pro AI",
                agent_side="a",
                content="Already done.",
                model_used="gpt-4o",
            ))
            await session.commit()

        resp = await client.post(
            f"/api/v1/debates/{debate_id}/next-turn",
            headers=auth_headers,
        )

    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_next_turn_missing_api_key_no_stored_key(app_with_db, auth_headers):
    """If no header key and no stored key for the provider, return 400."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Setup only anthropic key, not openai
        await _setup_keys(client, auth_headers, providers=("anthropic",))
        # Create debate requiring openai for agent_a (turn 0)
        # We need both keys to create the debate, so create with same provider
        body = _valid_create_body()
        body["agent_a"]["provider"] = "anthropic"
        body["agent_a"]["model"] = "claude-sonnet-4-20250514"
        resp = await client.post("/api/v1/debates", json=body, headers=auth_headers)
        debate_id = resp.json()["id"]

        # Delete the stored anthropic key
        await client.delete("/api/v1/keys/anthropic", headers=auth_headers)

        resp = await client.post(
            f"/api/v1/debates/{debate_id}/next-turn",
            headers=auth_headers,
        )

    assert resp.status_code == 400
    assert "api key" in resp.json()["detail"].lower() or "API key" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_next_turn_uses_stored_key_when_no_header(app_with_db, auth_headers):
    """If no header key but a stored key exists, use the stored key."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        # Don't pass X-OpenAI-Key header — should fall back to stored key
        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=_mock_streamed_result(["Stored key works."]),
        ), patch("app.services.debate_orchestrator.create_agent"):
            resp = await client.post(
                f"/api/v1/debates/{debate_id}/next-turn",
                headers=auth_headers,
            )

    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    assert any(e["event"] == "turn_complete" for e in events)


@pytest.mark.asyncio
async def test_next_turn_uses_header_key_when_provided(app_with_db, auth_headers):
    """When X-OpenAI-Key header is provided, use it instead of stored key."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=_mock_streamed_result(["Header key used."]),
        ), patch("app.services.debate_orchestrator.create_agent") as mock_create:
            resp = await client.post(
                f"/api/v1/debates/{debate_id}/next-turn",
                headers={**auth_headers, "X-OpenAI-Key": "sk-header-key-value"},
            )

    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    assert any(e["event"] == "turn_complete" for e in events)


@pytest.mark.asyncio
async def test_next_turn_error_pauses_debate(app_with_db, auth_headers):
    """Provider error should emit error event and pause the debate."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            side_effect=RuntimeError("Provider exploded"),
        ), patch("app.services.debate_orchestrator.create_agent"):
            resp = await client.post(
                f"/api/v1/debates/{debate_id}/next-turn",
                headers=auth_headers,
            )

    assert resp.status_code == 200  # SSE stream started, error emitted within
    events = _parse_sse_events(resp.text)
    assert any(e["event"] == "error" for e in events)

    # Debate should be paused
    async with sf() as session:
        debate = (
            await session.execute(select(Debate).where(Debate.id == uuid.UUID(debate_id)))
        ).scalar_one()
        assert debate.status == "paused"
        assert debate.current_turn == 0  # Not incremented


@pytest.mark.asyncio
async def test_next_turn_completes_debate_on_last_turn(app_with_db, auth_headers):
    """When streaming the last turn, debate status should become 'completed'."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        # Set debate to turn 5 of 6
        async with sf() as session:
            await session.execute(
                update(Debate)
                .where(Debate.id == uuid.UUID(debate_id))
                .values(current_turn=5, max_turns=6, status="running")
            )
            for i in range(5):
                side = "a" if i % 2 == 0 else "b"
                name = "Pro AI" if side == "a" else "Skeptic"
                model = "gpt-4o" if side == "a" else "claude-sonnet-4-20250514"
                session.add(Turn(
                    debate_id=uuid.UUID(debate_id),
                    turn_number=i,
                    agent_name=name,
                    agent_side=side,
                    content=f"Turn {i} content",
                    model_used=model,
                ))
            await session.commit()

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=_mock_streamed_result(["Final argument."]),
        ), patch("app.services.debate_orchestrator.create_agent"):
            resp = await client.post(
                f"/api/v1/debates/{debate_id}/next-turn",
                headers=auth_headers,
            )

    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)
    complete = next(e for e in events if e["event"] == "turn_complete")
    assert complete["data"]["debate_status"] == "completed"

    async with sf() as session:
        debate = (
            await session.execute(select(Debate).where(Debate.id == uuid.UUID(debate_id)))
        ).scalar_one()
        assert debate.status == "completed"
        assert debate.current_turn == 6


@pytest.mark.asyncio
async def test_next_turn_no_auth(app_with_db):
    """Request without auth should fail."""
    app, _ = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(f"/api/v1/debates/{uuid.uuid4()}/next-turn")
    assert resp.status_code == 422  # Missing Authorization header


@pytest.mark.asyncio
async def test_next_turn_sets_status_to_running(app_with_db, auth_headers):
    """First turn should transition status from 'created' to 'running'."""
    app, sf = app_with_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        debate_id = await _create_debate(client, auth_headers)

        # Verify initial status is 'created'
        async with sf() as session:
            debate = (
                await session.execute(select(Debate).where(Debate.id == uuid.UUID(debate_id)))
            ).scalar_one()
            assert debate.status == "created"

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=_mock_streamed_result(["Opening."]),
        ), patch("app.services.debate_orchestrator.create_agent"):
            resp = await client.post(
                f"/api/v1/debates/{debate_id}/next-turn",
                headers=auth_headers,
            )

    assert resp.status_code == 200

    async with sf() as session:
        debate = (
            await session.execute(select(Debate).where(Debate.id == uuid.UUID(debate_id)))
        ).scalar_one()
        assert debate.status == "running"
