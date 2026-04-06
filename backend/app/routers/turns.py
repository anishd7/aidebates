"""Next-turn endpoint: generate one debate turn via SSE streaming."""

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.debate import Debate
from app.models.turn import Turn
from app.services.debate_orchestrator import get_turn_agent_info, stream_turn
from app.services.encryption import decrypt_key
from app.models.api_key import UserApiKey

router = APIRouter(tags=["turns"])


@router.post("/debates/{debate_id}/next-turn")
async def next_turn(
    debate_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_openai_key: str | None = Header(default=None, alias="X-OpenAI-Key"),
    x_anthropic_key: str | None = Header(default=None, alias="X-Anthropic-Key"),
) -> Response:
    """Generate the next debate turn, streamed as SSE events.

    Determines which agent speaks next, validates the required API key header,
    reconstructs conversation history, and streams the turn via SSE.

    Returns:
        EventSourceResponse with turn_start, token, turn_complete events on success.
        204 if the debate is already complete.
        400 if the required API key header is missing.
        404 if the debate is not found or not owned by the user.
        409 if the turn has already been generated (race condition).
    """
    uid = uuid.UUID(user_id)

    # 1. Load debate (no lock — optimistic concurrency)
    result = await db.execute(
        select(Debate).where(Debate.id == debate_id)
    )
    debate = result.scalar_one_or_none()

    if debate is None or debate.user_id != uid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Debate not found",
        )

    # 2. If debate is already complete, mark status and return 204
    if debate.current_turn >= debate.max_turns:
        if debate.status != "completed":
            await db.execute(
                update(Debate)
                .where(Debate.id == debate.id)
                .values(status="completed")
            )
            await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    turn_number = debate.current_turn

    # 3. Check if turn already exists (race condition guard)
    existing_turn = (
        await db.execute(
            select(Turn.id).where(
                Turn.debate_id == debate.id,
                Turn.turn_number == turn_number,
            )
        )
    ).scalar_one_or_none()

    if existing_turn is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Turn already exists — another request completed it",
        )

    # 4. Determine which agent speaks and validate API key header
    agent_info = get_turn_agent_info(debate, turn_number)
    provider = agent_info["agent_config"]["provider"]

    if provider == "openai":
        raw_key = x_openai_key
        header_name = "X-OpenAI-Key"
    elif provider == "anthropic":
        raw_key = x_anthropic_key
        header_name = "X-Anthropic-Key"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}",
        )

    if not raw_key:
        # Try to load encrypted key from DB as fallback
        stored_key_row = (
            await db.execute(
                select(UserApiKey).where(
                    UserApiKey.user_id == uid,
                    UserApiKey.provider == provider,
                )
            )
        ).scalar_one_or_none()

        if stored_key_row is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing API key: provide {header_name} header or save a {provider} key in settings",
            )

        api_key = decrypt_key(stored_key_row.encrypted_key)
    else:
        api_key = raw_key

    # 5. Load all existing turns ordered by turn_number
    existing_turns = (
        await db.execute(
            select(Turn)
            .where(Turn.debate_id == debate.id)
            .order_by(Turn.turn_number)
        )
    ).scalars().all()

    # 6. Set status to running if it isn't already
    if debate.status != "running":
        await db.execute(
            update(Debate)
            .where(Debate.id == debate.id)
            .values(status="running")
        )
        await db.commit()
        debate.status = "running"

    # 7. Return SSE stream
    return EventSourceResponse(
        stream_turn(debate, list(existing_turns), api_key, db)
    )
