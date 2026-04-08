"""Authentication endpoints for credentials-based sign-up and sign-in."""

import uuid

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str | None = None


class LoginRequest(BaseModel):
    login: str = Field(description="Username or email")
    password: str


class AuthResponse(BaseModel):
    id: str
    email: str
    username: str | None
    name: str | None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with username/email/password."""
    # Check for existing email
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Check for existing username
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        id=uuid.uuid4(),
        email=body.email,
        username=body.username,
        password_hash=hash_password(body.password),
        name=body.name or body.username,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        name=user.name,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with username/email and password."""
    # Try to find by email or username
    result = await db.execute(
        select(User).where(
            (User.email == body.login) | (User.username == body.login)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return AuthResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        name=user.name,
    )
