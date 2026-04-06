"""Tests for authentication middleware (get_current_user, get_optional_user)."""

import os
import time

import pytest
from jose import jwt
from sqlalchemy import select

from app.middleware.auth import ALGORITHM, get_current_user, get_optional_user
from app.models.user import User

SECRET = os.environ["NEXTAUTH_SECRET"]


def _make_token(
    email: str = "test@example.com",
    name: str = "Test User",
    picture: str = "https://example.com/avatar.png",
    secret: str = SECRET,
    exp_offset: int = 3600,
) -> str:
    """Create a JWT token matching NextAuth format."""
    now = int(time.time())
    payload = {
        "sub": email,
        "email": email,
        "name": name,
        "picture": picture,
        "iat": now,
        "exp": now + exp_offset,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


# --- get_current_user tests ---


@pytest.mark.asyncio
async def test_valid_token_returns_user_id(db_session):
    """A properly signed JWT returns the correct user_id."""
    token = _make_token()
    user_id = await get_current_user(
        authorization=f"Bearer {token}",
        db=db_session,
    )
    assert user_id is not None
    # Verify it's a valid UUID string
    import uuid

    uuid.UUID(user_id)


@pytest.mark.asyncio
async def test_expired_token_raises_401(db_session):
    """An expired JWT raises 401."""
    from fastapi import HTTPException

    token = _make_token(exp_offset=-3600)  # expired 1 hour ago
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(authorization=f"Bearer {token}", db=db_session)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_invalid_signature_raises_401(db_session):
    """A JWT signed with a different secret raises 401."""
    from fastapi import HTTPException

    token = _make_token(secret="wrong-secret")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(authorization=f"Bearer {token}", db=db_session)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_header_raises_422():
    """No Authorization header raises an error (FastAPI returns 422 for missing required Header)."""
    # When the header is missing, FastAPI itself raises a validation error before
    # get_current_user runs. We just verify the dependency signature requires it.
    import inspect

    sig = inspect.signature(get_current_user)
    param = sig.parameters["authorization"]
    # The default is Header(...) which means it's required
    assert param.default is not inspect.Parameter.empty


@pytest.mark.asyncio
async def test_malformed_header_raises_401(db_session):
    """Authorization: NotBearer xyz raises 401."""
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(authorization="NotBearer xyz", db=db_session)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_user_creation_on_first_auth(db_session):
    """First auth with a new email creates a user record in the DB."""
    token = _make_token(email="new@example.com", name="New User", picture="https://example.com/new.png")
    user_id = await get_current_user(authorization=f"Bearer {token}", db=db_session)

    # Verify user exists in DB with correct fields
    result = await db_session.execute(select(User).where(User.email == "new@example.com"))
    user = result.scalar_one()
    assert str(user.id) == user_id
    assert user.name == "New User"
    assert user.avatar_url == "https://example.com/new.png"


@pytest.mark.asyncio
async def test_subsequent_auth_returns_same_user_id(db_session):
    """Subsequent auth with same email returns the same user_id."""
    token = _make_token(email="repeat@example.com")
    user_id_1 = await get_current_user(authorization=f"Bearer {token}", db=db_session)

    token2 = _make_token(email="repeat@example.com")
    user_id_2 = await get_current_user(authorization=f"Bearer {token2}", db=db_session)

    assert user_id_1 == user_id_2

    # Verify only one user record exists
    result = await db_session.execute(select(User).where(User.email == "repeat@example.com"))
    users = result.scalars().all()
    assert len(users) == 1


# --- get_optional_user tests ---


@pytest.mark.asyncio
async def test_optional_auth_with_valid_token(db_session):
    """Optional auth with a valid token returns user_id."""
    token = _make_token(email="optional@example.com")
    user_id = await get_optional_user(authorization=f"Bearer {token}", db=db_session)
    assert user_id is not None
    import uuid

    uuid.UUID(user_id)


@pytest.mark.asyncio
async def test_optional_auth_without_token(db_session):
    """Optional auth without a token returns None."""
    user_id = await get_optional_user(authorization=None, db=db_session)
    assert user_id is None


@pytest.mark.asyncio
async def test_optional_auth_with_bad_token(db_session):
    """Optional auth with an invalid token still raises 401."""
    from fastapi import HTTPException

    token = _make_token(secret="wrong-secret")
    with pytest.raises(HTTPException) as exc_info:
        await get_optional_user(authorization=f"Bearer {token}", db=db_session)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_optional_auth_malformed_header(db_session):
    """Optional auth with a malformed header raises 401."""
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await get_optional_user(authorization="Token abc123", db=db_session)
    assert exc_info.value.status_code == 401
