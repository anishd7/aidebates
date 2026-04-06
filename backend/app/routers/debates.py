"""Debate CRUD endpoints: create, list, and retrieve debates."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user, get_optional_user
from app.models.api_key import UserApiKey
from app.models.debate import Debate
from app.schemas.debates import (
    CreateDebateRequest,
    DebateListItem,
    DebateListResponse,
    DebateResponse,
)

router = APIRouter(tags=["debates"])


@router.post(
    "/debates",
    response_model=DebateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_debate(
    body: CreateDebateRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DebateResponse:
    """Create a new debate with the given topic and agent configurations."""
    uid = uuid.UUID(user_id)

    # Collect the set of providers needed by both agents
    required_providers = {body.agent_a.provider.value, body.agent_b.provider.value}

    # Check that the user has API keys for all required providers
    result = await db.execute(
        select(UserApiKey.provider).where(
            UserApiKey.user_id == uid,
            UserApiKey.provider.in_(required_providers),
        )
    )
    stored_providers = {row[0] for row in result.all()}

    missing = required_providers - stored_providers
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing API key(s) for provider(s): {', '.join(sorted(missing))}",
        )

    debate = Debate(
        id=uuid.uuid4(),
        user_id=uid,
        topic=body.topic,
        agent_a_config=body.agent_a.model_dump(),
        agent_b_config=body.agent_b.model_dump(),
        status="created",
        current_turn=0,
        max_turns=body.max_turns,
    )
    db.add(debate)
    await db.commit()
    await db.refresh(debate)

    return DebateResponse(
        id=str(debate.id),
        topic=debate.topic,
        agent_a_config=debate.agent_a_config,
        agent_b_config=debate.agent_b_config,
        status=debate.status,
        current_turn=debate.current_turn,
        max_turns=debate.max_turns,
        turns=[],
        created_at=debate.created_at,
        updated_at=debate.updated_at,
    )


@router.get("/debates", response_model=DebateListResponse)
async def list_debates(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DebateListResponse:
    """List the authenticated user's debates, ordered by most recent first."""
    uid = uuid.UUID(user_id)

    # Base filter
    conditions = [Debate.user_id == uid]
    if status_filter is not None:
        conditions.append(Debate.status == status_filter)

    # Total count
    count_stmt = select(func.count()).select_from(Debate).where(*conditions)
    total = (await db.execute(count_stmt)).scalar_one()

    # Paginated results
    stmt = (
        select(Debate)
        .where(*conditions)
        .order_by(Debate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    debates = result.scalars().all()

    items = [
        DebateListItem(
            id=str(d.id),
            topic=d.topic,
            status=d.status,
            current_turn=d.current_turn,
            max_turns=d.max_turns,
            agent_a_name=d.agent_a_config.get("name", ""),
            agent_b_name=d.agent_b_config.get("name", ""),
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in debates
    ]

    return DebateListResponse(debates=items, total=total, limit=limit, offset=offset)


@router.get("/debates/{debate_id}", response_model=DebateResponse)
async def get_debate(
    debate_id: uuid.UUID,
    user_id: str | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> DebateResponse:
    """Get a debate with its full turn history.

    Owner access: authenticated user who created the debate.
    Public access: anyone can view a completed debate (shared link).
    """
    stmt = (
        select(Debate)
        .options(selectinload(Debate.turns))
        .where(Debate.id == debate_id)
    )
    result = await db.execute(stmt)
    debate = result.scalar_one_or_none()

    if debate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Debate not found",
        )

    is_owner = user_id is not None and str(debate.user_id) == user_id

    if not is_owner and debate.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Debate not found",
        )

    return DebateResponse.model_validate(debate)
