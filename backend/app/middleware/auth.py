"""Authentication middleware for JWT validation and user management."""

import uuid

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

ALGORITHM = "HS256"


async def _validate_token_and_get_user(token: str, db: AsyncSession) -> str:
    """Validate a JWT token, ensure the user exists in DB, and return user_id.

    If the user does not exist, create them from token claims.
    Returns the user's UUID as a string.
    Raises HTTPException(401) on any failure.
    """
    try:
        payload = jwt.decode(token, settings.NEXTAUTH_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    email: str | None = payload.get("email") or payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    # Look up user by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        # Create user on first authentication
        user = User(
            id=uuid.uuid4(),
            email=email,
            name=payload.get("name"),
            avatar_url=payload.get("picture"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return str(user.id)


async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> str:
    """FastAPI dependency: require a valid JWT and return the user_id.

    Raises HTTPException(401) if the token is missing, malformed, or invalid.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    token = authorization[len("Bearer "):]
    return await _validate_token_and_get_user(token, db)


async def get_optional_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> str | None:
    """FastAPI dependency: optionally authenticate.

    Returns user_id if a valid token is provided, None if no token is provided.
    Raises HTTPException(401) if a token IS provided but is invalid.
    """
    if authorization is None:
        return None

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    token = authorization[len("Bearer "):]
    return await _validate_token_and_get_user(token, db)
