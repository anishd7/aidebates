"""Tests for backend/app/schemas/debates.py Pydantic schemas."""

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.debates import (
    AgentConfigInput,
    CreateDebateRequest,
    DebateListItem,
    DebateListResponse,
    DebateResponse,
    TurnResponse,
)


class TestAgentConfigInput:
    def test_valid_config(self):
        config = AgentConfigInput(
            name="Agent A",
            personality="You are a helpful debater.",
            provider="openai",
            model="gpt-4o",
        )
        assert config.name == "Agent A"
        assert config.personality == "You are a helpful debater."
        assert config.provider.value == "openai"
        assert config.model == "gpt-4o"

    def test_anthropic_provider(self):
        config = AgentConfigInput(
            name="Claude",
            personality="Thoughtful debater",
            provider="anthropic",
            model="claude-sonnet-4-20250514",
        )
        assert config.provider.value == "anthropic"

    def test_invalid_provider_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            AgentConfigInput(
                name="Agent",
                personality="Test",
                provider="google",
                model="gemini",
            )
        assert "provider" in str(exc_info.value)

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            AgentConfigInput(
                name="",
                personality="Test personality",
                provider="openai",
                model="gpt-4o",
            )

    def test_name_too_long_rejected(self):
        with pytest.raises(ValidationError):
            AgentConfigInput(
                name="A" * 101,
                personality="Test personality",
                provider="openai",
                model="gpt-4o",
            )

    def test_name_max_length_accepted(self):
        config = AgentConfigInput(
            name="A" * 100,
            personality="Test personality",
            provider="openai",
            model="gpt-4o",
        )
        assert len(config.name) == 100

    def test_empty_personality_rejected(self):
        with pytest.raises(ValidationError):
            AgentConfigInput(
                name="Agent",
                personality="",
                provider="openai",
                model="gpt-4o",
            )

    def test_personality_too_long_rejected(self):
        with pytest.raises(ValidationError):
            AgentConfigInput(
                name="Agent",
                personality="P" * 1001,
                provider="openai",
                model="gpt-4o",
            )

    def test_personality_max_length_accepted(self):
        config = AgentConfigInput(
            name="Agent",
            personality="P" * 1000,
            provider="openai",
            model="gpt-4o",
        )
        assert len(config.personality) == 1000

    def test_empty_model_rejected(self):
        with pytest.raises(ValidationError):
            AgentConfigInput(
                name="Agent",
                personality="Test",
                provider="openai",
                model="",
            )

    def test_missing_fields_rejected(self):
        with pytest.raises(ValidationError):
            AgentConfigInput(name="Agent")


class TestCreateDebateRequest:
    def _agent(self, **overrides):
        defaults = {
            "name": "Agent",
            "personality": "Test personality",
            "provider": "openai",
            "model": "gpt-4o",
        }
        defaults.update(overrides)
        return AgentConfigInput(**defaults)

    def test_valid_request(self):
        req = CreateDebateRequest(
            topic="Is AI beneficial?",
            agent_a=self._agent(name="Pro AI"),
            agent_b=self._agent(name="Anti AI", provider="anthropic", model="claude-sonnet-4-20250514"),
            max_turns=10,
        )
        assert req.topic == "Is AI beneficial?"
        assert req.agent_a.name == "Pro AI"
        assert req.agent_b.provider.value == "anthropic"
        assert req.max_turns == 10

    def test_default_max_turns(self):
        req = CreateDebateRequest(
            topic="Test topic",
            agent_a=self._agent(),
            agent_b=self._agent(),
        )
        assert req.max_turns == 100

    def test_empty_topic_rejected(self):
        with pytest.raises(ValidationError):
            CreateDebateRequest(
                topic="",
                agent_a=self._agent(),
                agent_b=self._agent(),
            )

    def test_topic_too_long_rejected(self):
        with pytest.raises(ValidationError):
            CreateDebateRequest(
                topic="T" * 2001,
                agent_a=self._agent(),
                agent_b=self._agent(),
            )

    def test_topic_max_length_accepted(self):
        req = CreateDebateRequest(
            topic="T" * 2000,
            agent_a=self._agent(),
            agent_b=self._agent(),
        )
        assert len(req.topic) == 2000

    def test_max_turns_below_minimum_rejected(self):
        with pytest.raises(ValidationError):
            CreateDebateRequest(
                topic="Test",
                agent_a=self._agent(),
                agent_b=self._agent(),
                max_turns=1,
            )

    def test_max_turns_zero_rejected(self):
        with pytest.raises(ValidationError):
            CreateDebateRequest(
                topic="Test",
                agent_a=self._agent(),
                agent_b=self._agent(),
                max_turns=0,
            )

    def test_max_turns_above_maximum_rejected(self):
        with pytest.raises(ValidationError):
            CreateDebateRequest(
                topic="Test",
                agent_a=self._agent(),
                agent_b=self._agent(),
                max_turns=101,
            )

    def test_max_turns_boundary_values(self):
        req_min = CreateDebateRequest(
            topic="Test",
            agent_a=self._agent(),
            agent_b=self._agent(),
            max_turns=2,
        )
        assert req_min.max_turns == 2

        req_max = CreateDebateRequest(
            topic="Test",
            agent_a=self._agent(),
            agent_b=self._agent(),
            max_turns=100,
        )
        assert req_max.max_turns == 100


class TestTurnResponse:
    def test_valid_turn(self):
        now = datetime.now(timezone.utc)
        turn = TurnResponse(
            turn_number=1,
            agent_name="Pro AI",
            agent_side="a",
            content="I believe AI is beneficial because...",
            model_used="gpt-4o",
            created_at=now,
        )
        assert turn.turn_number == 1
        assert turn.agent_name == "Pro AI"
        assert turn.agent_side == "a"
        assert turn.content == "I believe AI is beneficial because..."
        assert turn.model_used == "gpt-4o"
        assert turn.created_at == now

    def test_from_attributes(self):
        """Verify from_attributes works for ORM model compatibility."""

        class FakeTurnORM:
            turn_number = 3
            agent_name = "Skeptic"
            agent_side = "b"
            content = "However, there are concerns..."
            model_used = "claude-sonnet-4-20250514"
            created_at = datetime(2025, 6, 1, tzinfo=timezone.utc)

        turn = TurnResponse.model_validate(FakeTurnORM())
        assert turn.turn_number == 3
        assert turn.agent_name == "Skeptic"
        assert turn.agent_side == "b"


class TestDebateResponse:
    def test_valid_response(self):
        now = datetime.now(timezone.utc)
        debate_id = str(uuid.uuid4())
        resp = DebateResponse(
            id=debate_id,
            topic="Is AI beneficial?",
            agent_a_config={"name": "Pro", "provider": "openai", "model": "gpt-4o", "personality": "Optimistic"},
            agent_b_config={"name": "Con", "provider": "anthropic", "model": "claude-sonnet-4-20250514", "personality": "Skeptical"},
            status="created",
            current_turn=0,
            max_turns=10,
            turns=[],
            created_at=now,
            updated_at=now,
        )
        assert resp.id == debate_id
        assert resp.status == "created"
        assert resp.turns == []

    def test_with_turns(self):
        now = datetime.now(timezone.utc)
        resp = DebateResponse(
            id=str(uuid.uuid4()),
            topic="Test",
            agent_a_config={"name": "A"},
            agent_b_config={"name": "B"},
            status="running",
            current_turn=2,
            max_turns=10,
            turns=[
                TurnResponse(
                    turn_number=1,
                    agent_name="A",
                    agent_side="a",
                    content="First argument",
                    model_used="gpt-4o",
                    created_at=now,
                ),
                TurnResponse(
                    turn_number=2,
                    agent_name="B",
                    agent_side="b",
                    content="Counterpoint",
                    model_used="claude-sonnet-4-20250514",
                    created_at=now,
                ),
            ],
            created_at=now,
        )
        assert len(resp.turns) == 2
        assert resp.current_turn == 2

    def test_default_empty_turns(self):
        now = datetime.now(timezone.utc)
        resp = DebateResponse(
            id=str(uuid.uuid4()),
            topic="Test",
            agent_a_config={},
            agent_b_config={},
            status="created",
            current_turn=0,
            max_turns=10,
            created_at=now,
        )
        assert resp.turns == []
        assert resp.updated_at is None

    def test_from_attributes_with_uuid(self):
        """Verify UUID id is converted to string via from_attributes."""
        now = datetime.now(timezone.utc)
        debate_uuid = uuid.uuid4()

        class FakeDebateORM:
            id = debate_uuid
            topic = "Test topic"
            agent_a_config = {"name": "A"}
            agent_b_config = {"name": "B"}
            status = "completed"
            current_turn = 10
            max_turns = 10
            turns = []
            created_at = now
            updated_at = now

        resp = DebateResponse.model_validate(FakeDebateORM())
        assert resp.id == str(debate_uuid)
        assert resp.status == "completed"


class TestDebateListItem:
    def test_valid_list_item(self):
        now = datetime.now(timezone.utc)
        item = DebateListItem(
            id=str(uuid.uuid4()),
            topic="AI Debate",
            status="running",
            current_turn=5,
            max_turns=10,
            agent_a_name="Pro AI",
            agent_b_name="Anti AI",
            created_at=now,
            updated_at=now,
        )
        assert item.topic == "AI Debate"
        assert item.agent_a_name == "Pro AI"
        assert item.agent_b_name == "Anti AI"
        assert item.status == "running"


class TestDebateListResponse:
    def test_empty_list(self):
        resp = DebateListResponse(debates=[], total=0, limit=50, offset=0)
        assert resp.debates == []
        assert resp.total == 0

    def test_paginated_response(self):
        now = datetime.now(timezone.utc)
        items = [
            DebateListItem(
                id=str(uuid.uuid4()),
                topic=f"Topic {i}",
                status="completed",
                current_turn=10,
                max_turns=10,
                agent_a_name="Agent A",
                agent_b_name="Agent B",
                created_at=now,
                updated_at=now,
            )
            for i in range(3)
        ]
        resp = DebateListResponse(debates=items, total=25, limit=3, offset=6)
        assert len(resp.debates) == 3
        assert resp.total == 25
        assert resp.limit == 3
        assert resp.offset == 6
