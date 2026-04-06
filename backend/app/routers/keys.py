"""API key management endpoints for BYOK (Bring Your Own Key) providers."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.api_key import UserApiKey
from app.schemas.keys import (
    DecryptedKeysResponse,
    DeleteKeyResponse,
    KeyInfo,
    KeyListResponse,
    Provider,
    SaveKeyRequest,
)
from app.services.encryption import decrypt_key, encrypt_key, get_key_last_four

router = APIRouter(tags=["keys"])


@router.post("/keys", response_model=KeyInfo)
async def save_key(
    body: SaveKeyRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KeyInfo:
    """Save or update (upsert) an API key for a provider."""
    encrypted = encrypt_key(body.api_key)
    last_four = get_key_last_four(body.api_key)

    # Check if a key already exists for this user + provider
    result = await db.execute(
        select(UserApiKey).where(
            UserApiKey.user_id == uuid.UUID(user_id),
            UserApiKey.provider == body.provider.value,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.encrypted_key = encrypted
        existing.key_last_four = last_four
        await db.commit()
        await db.refresh(existing)
        return KeyInfo.model_validate(existing)

    new_key = UserApiKey(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user_id),
        provider=body.provider.value,
        encrypted_key=encrypted,
        key_last_four=last_four,
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)
    return KeyInfo.model_validate(new_key)


@router.get("/keys", response_model=KeyListResponse)
async def list_keys(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KeyListResponse:
    """List configured providers with masked key info (last 4 chars only)."""
    result = await db.execute(
        select(UserApiKey).where(UserApiKey.user_id == uuid.UUID(user_id))
    )
    keys = result.scalars().all()
    return KeyListResponse(keys=[KeyInfo.model_validate(k) for k in keys])


@router.get("/keys/decrypt", response_model=DecryptedKeysResponse)
async def decrypt_keys(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DecryptedKeysResponse:
    """Fetch full decrypted keys for all providers."""
    result = await db.execute(
        select(UserApiKey).where(UserApiKey.user_id == uuid.UUID(user_id))
    )
    keys = result.scalars().all()

    decrypted: dict[str, str | None] = {p.value: None for p in Provider}
    for key in keys:
        decrypted[key.provider] = decrypt_key(key.encrypted_key)

    return DecryptedKeysResponse(keys=decrypted)


@router.delete("/keys/{provider}", response_model=DeleteKeyResponse)
async def delete_key(
    provider: Provider,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeleteKeyResponse:
    """Delete a stored API key for the given provider."""
    result = await db.execute(
        select(UserApiKey).where(
            UserApiKey.user_id == uuid.UUID(user_id),
            UserApiKey.provider == provider.value,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No API key found for provider '{provider.value}'",
        )

    await db.delete(existing)
    await db.commit()
    return DeleteKeyResponse(deleted=True, provider=provider.value)
