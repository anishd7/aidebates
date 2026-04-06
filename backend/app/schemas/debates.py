from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, BeforeValidator, Field

from app.schemas.keys import Provider

StrFromUUID = Annotated[str, BeforeValidator(lambda v: str(v) if v is not None else v)]


class AgentConfigInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    personality: str = Field(..., min_length=1, max_length=1000)
    provider: Provider
    model: str = Field(..., min_length=1)


class CreateDebateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=2000)
    agent_a: AgentConfigInput
    agent_b: AgentConfigInput
    max_turns: int = Field(default=100, ge=2, le=100)


class TurnResponse(BaseModel):
    turn_number: int
    agent_name: str
    agent_side: str
    content: str
    model_used: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DebateResponse(BaseModel):
    id: StrFromUUID
    topic: str
    agent_a_config: dict
    agent_b_config: dict
    status: str
    current_turn: int
    max_turns: int
    turns: list[TurnResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DebateListItem(BaseModel):
    id: StrFromUUID
    topic: str
    status: str
    current_turn: int
    max_turns: int
    agent_a_name: str
    agent_b_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DebateListResponse(BaseModel):
    debates: list[DebateListItem]
    total: int
    limit: int
    offset: int
