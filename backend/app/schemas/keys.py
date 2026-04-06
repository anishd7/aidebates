from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Provider(str, Enum):
    openai = "openai"
    anthropic = "anthropic"


class SaveKeyRequest(BaseModel):
    provider: Provider
    api_key: str = Field(..., min_length=1)


class KeyInfo(BaseModel):
    provider: str
    key_last_four: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class KeyListResponse(BaseModel):
    keys: list[KeyInfo]


class DecryptedKeysResponse(BaseModel):
    keys: dict[str, Optional[str]]


class DeleteKeyResponse(BaseModel):
    deleted: bool
    provider: str
