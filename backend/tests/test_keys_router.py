"""Tests for the API key management endpoints (POST, GET, GET /decrypt, DELETE)."""

import os
import time

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.middleware.auth import ALGORITHM
from app.routers.keys import router
from fastapi import FastAPI

SECRET = os.environ["NEXTAUTH_SECRET"]
TEST_DATABASE_URL = os.environ["DATABASE_URL"]


def _make_token(email: str = "keys@example.com") -> str:
    now = int(time.time())
    payload = {
        "sub": email,
        "email": email,
        "name": "Key User",
        "picture": "https://example.com/avatar.png",
        "iat": now,
        "exp": now + 3600,
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


@pytest.fixture
def auth_headers():
    token = _make_token()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_other():
    token = _make_token(email="other@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def app_with_db():
    """Create a FastAPI app with the keys router and a fresh database."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_db] = override_get_db

    yield app

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# --- POST /api/v1/keys ---


@pytest.mark.asyncio
async def test_save_key_returns_key_info(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-test1234abcd"},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "openai"
    assert body["key_last_four"] == "abcd"
    assert "updated_at" in body


@pytest.mark.asyncio
async def test_save_key_upsert_updates_existing(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        # Save initial key
        resp1 = await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-first1111"},
            headers=auth_headers,
        )
        assert resp1.status_code == 200
        assert resp1.json()["key_last_four"] == "1111"

        # Upsert with new key
        resp2 = await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-second2222"},
            headers=auth_headers,
        )
        assert resp2.status_code == 200
        assert resp2.json()["key_last_four"] == "2222"

        # Verify only one key exists
        resp_list = await client.get("/api/v1/keys", headers=auth_headers)
        assert len(resp_list.json()["keys"]) == 1


@pytest.mark.asyncio
async def test_save_key_invalid_provider(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/v1/keys",
            json={"provider": "google", "api_key": "key123"},
            headers=auth_headers,
        )
    assert resp.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_save_key_no_auth(app_with_db):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-test1234"},
        )
    assert resp.status_code == 422  # Missing required Authorization header


# --- GET /api/v1/keys ---


@pytest.mark.asyncio
async def test_list_keys_returns_metadata_only(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        # Save two keys
        await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-openaiXXXX"},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/keys",
            json={"provider": "anthropic", "api_key": "sk-anthropicYYYY"},
            headers=auth_headers,
        )

        resp = await client.get("/api/v1/keys", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["keys"]) == 2
    providers = {k["provider"] for k in body["keys"]}
    assert providers == {"openai", "anthropic"}
    # Ensure no full keys are leaked
    for key in body["keys"]:
        assert len(key["key_last_four"]) == 4
        assert "encrypted_key" not in key
        assert "api_key" not in key


@pytest.mark.asyncio
async def test_list_keys_empty(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/keys", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["keys"] == []


# --- GET /api/v1/keys/decrypt ---


@pytest.mark.asyncio
async def test_decrypt_keys_returns_full_keys(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-openai-full-key"},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/keys",
            json={"provider": "anthropic", "api_key": "sk-anthropic-full-key"},
            headers=auth_headers,
        )

        resp = await client.get("/api/v1/keys/decrypt", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["keys"]["openai"] == "sk-openai-full-key"
    assert body["keys"]["anthropic"] == "sk-anthropic-full-key"


@pytest.mark.asyncio
async def test_decrypt_keys_with_no_keys(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/keys/decrypt", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["keys"]["openai"] is None
    assert body["keys"]["anthropic"] is None


# --- DELETE /api/v1/keys/{provider} ---


@pytest.mark.asyncio
async def test_delete_key_success(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        # Save a key first
        await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-to-delete"},
            headers=auth_headers,
        )

        # Delete it
        resp = await client.delete("/api/v1/keys/openai", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["deleted"] is True
    assert body["provider"] == "openai"


@pytest.mark.asyncio
async def test_delete_key_verifies_removal(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-to-delete"},
            headers=auth_headers,
        )
        await client.delete("/api/v1/keys/openai", headers=auth_headers)

        # Verify it's gone from list
        resp = await client.get("/api/v1/keys", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["keys"] == []


@pytest.mark.asyncio
async def test_delete_nonexistent_key_returns_404(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        resp = await client.delete("/api/v1/keys/openai", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_invalid_provider_returns_422(app_with_db, auth_headers):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        resp = await client.delete("/api/v1/keys/google", headers=auth_headers)
    assert resp.status_code == 422  # Pydantic enum validation


# --- User isolation ---


@pytest.mark.asyncio
async def test_keys_are_isolated_per_user(app_with_db, auth_headers, auth_headers_other):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_db), base_url="http://test"
    ) as client:
        # User 1 saves a key
        await client.post(
            "/api/v1/keys",
            json={"provider": "openai", "api_key": "sk-user1-key"},
            headers=auth_headers,
        )

        # User 2 should see no keys
        resp = await client.get("/api/v1/keys", headers=auth_headers_other)
        assert resp.json()["keys"] == []

        # User 2 decrypt should show nulls
        resp = await client.get("/api/v1/keys/decrypt", headers=auth_headers_other)
        assert resp.json()["keys"]["openai"] is None
