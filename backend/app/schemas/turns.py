from datetime import datetime

from pydantic import BaseModel


class TurnResponse(BaseModel):
    turn_number: int
    agent_name: str
    agent_side: str
    content: str
    model_used: str
    created_at: datetime

    model_config = {"from_attributes": True}
