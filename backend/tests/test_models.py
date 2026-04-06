import uuid

import pytest
from sqlalchemy import select

from app.models import Debate, Turn, User, UserApiKey


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = User(email="test@example.com", name="Test User")
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(select(User).where(User.email == "test@example.com"))
    fetched = result.scalar_one()
    assert fetched.email == "test@example.com"
    assert fetched.name == "Test User"
    assert fetched.id is not None


@pytest.mark.asyncio
async def test_create_api_key(db_session):
    user = User(email="keys@example.com", name="Key User")
    db_session.add(user)
    await db_session.commit()

    api_key = UserApiKey(
        user_id=user.id,
        provider="openai",
        encrypted_key="encrypted_data_here",
        key_last_four="abcd",
    )
    db_session.add(api_key)
    await db_session.commit()

    result = await db_session.execute(select(UserApiKey).where(UserApiKey.user_id == user.id))
    fetched = result.scalar_one()
    assert fetched.provider == "openai"
    assert fetched.key_last_four == "abcd"


@pytest.mark.asyncio
async def test_create_debate(db_session):
    user = User(email="debate@example.com", name="Debater")
    db_session.add(user)
    await db_session.commit()

    debate = Debate(
        user_id=user.id,
        topic="Is AI good for humanity?",
        agent_a_config={"name": "Pro", "personality": "optimistic", "provider": "openai", "model": "gpt-4o"},
        agent_b_config={"name": "Con", "personality": "skeptical", "provider": "anthropic", "model": "claude-sonnet-4-20250514"},
        status="created",
        max_turns=6,
    )
    db_session.add(debate)
    await db_session.commit()

    result = await db_session.execute(select(Debate).where(Debate.user_id == user.id))
    fetched = result.scalar_one()
    assert fetched.topic == "Is AI good for humanity?"
    assert fetched.agent_a_config["name"] == "Pro"
    assert fetched.status == "created"
    assert fetched.current_turn == 0
    assert fetched.max_turns == 6


@pytest.mark.asyncio
async def test_create_turn(db_session):
    user = User(email="turn@example.com", name="Turner")
    db_session.add(user)
    await db_session.commit()

    debate = Debate(
        user_id=user.id,
        topic="Test topic",
        agent_a_config={"name": "A", "personality": "a", "provider": "openai", "model": "gpt-4o"},
        agent_b_config={"name": "B", "personality": "b", "provider": "anthropic", "model": "claude-sonnet-4-20250514"},
    )
    db_session.add(debate)
    await db_session.commit()

    turn = Turn(
        debate_id=debate.id,
        turn_number=1,
        agent_name="A",
        agent_side="a",
        content="This is my opening argument.",
        model_used="gpt-4o",
    )
    db_session.add(turn)
    await db_session.commit()

    result = await db_session.execute(select(Turn).where(Turn.debate_id == debate.id))
    fetched = result.scalar_one()
    assert fetched.turn_number == 1
    assert fetched.agent_side == "a"
    assert fetched.content == "This is my opening argument."


@pytest.mark.asyncio
async def test_jsonb_roundtrip(db_session):
    user = User(email="jsonb@example.com")
    db_session.add(user)
    await db_session.commit()

    config = {"name": "Agent", "personality": "thoughtful", "provider": "openai", "model": "gpt-4o"}
    debate = Debate(
        user_id=user.id,
        topic="JSONB test",
        agent_a_config=config,
        agent_b_config=config,
    )
    db_session.add(debate)
    await db_session.commit()

    result = await db_session.execute(select(Debate).where(Debate.id == debate.id))
    fetched = result.scalar_one()
    assert fetched.agent_a_config == config
