"""Tests for the debate orchestrator service."""

from __future__ import annotations

import builtins
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from agents.items import MessageOutputItem
from openai.types.responses import ResponseTextDeltaEvent
from sqlalchemy import select

from app.models.debate import Debate
from app.models.turn import Turn
from app.models.user import User
from app.services.debate_orchestrator import (
    build_agent_input,
    classify_error,
    get_turn_agent_info,
    stream_turn,
)

_real_isinstance = builtins.isinstance

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

AGENT_A_CONFIG = {
    "name": "Pro Regulation",
    "personality": "Analytical and data-driven",
    "provider": "openai",
    "model": "gpt-4.1",
}
AGENT_B_CONFIG = {
    "name": "Free Market",
    "personality": "Creative and persuasive",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
}
TOPIC = "Should AI be regulated by the government?"


def _fake_turn(turn_number: int, agent_side: str, agent_name: str, content: str):
    """Create a lightweight turn-like object for pure unit tests."""
    return SimpleNamespace(
        turn_number=turn_number,
        agent_side=agent_side,
        agent_name=agent_name,
        content=content,
        model_used="gpt-4.1" if agent_side == "a" else "claude-sonnet-4-20250514",
    )


def _fake_debate():
    """Create a lightweight debate-like object for pure unit tests."""
    return SimpleNamespace(
        agent_a_config=AGENT_A_CONFIG,
        agent_b_config=AGENT_B_CONFIG,
    )


# ---------------------------------------------------------------------------
# build_agent_input
# ---------------------------------------------------------------------------


class TestBuildAgentInput:
    def test_first_turn_no_existing_turns(self):
        result = build_agent_input(TOPIC, [], "a", "Pro Regulation", "Free Market")
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert TOPIC in result[0]["content"]
        assert "opening argument" in result[0]["content"]

    def test_second_turn_agent_b_perspective(self):
        turns = [_fake_turn(0, "a", "Pro Regulation", "Regulation is necessary.")]
        result = build_agent_input(TOPIC, turns, "b", "Free Market", "Pro Regulation")

        assert len(result) == 3
        assert result[0]["role"] == "user"
        assert "conversation so far" in result[0]["content"]
        assert result[1]["role"] == "user"
        assert result[1]["content"] == "[Pro Regulation]: Regulation is necessary."
        assert result[2]["role"] == "user"
        assert "next argument" in result[2]["content"]

    def test_third_turn_agent_a_perspective(self):
        turns = [
            _fake_turn(0, "a", "Pro Regulation", "Opening by A."),
            _fake_turn(1, "b", "Free Market", "Rebuttal by B."),
        ]
        result = build_agent_input(TOPIC, turns, "a", "Pro Regulation", "Free Market")

        assert len(result) == 4
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == "Opening by A."
        assert result[2]["role"] == "user"
        assert result[2]["content"] == "[Free Market]: Rebuttal by B."

    def test_fourth_turn_agent_b_sees_own_turns_as_assistant(self):
        turns = [
            _fake_turn(0, "a", "Pro Regulation", "A0"),
            _fake_turn(1, "b", "Free Market", "B1"),
            _fake_turn(2, "a", "Pro Regulation", "A2"),
        ]
        result = build_agent_input(TOPIC, turns, "b", "Free Market", "Pro Regulation")

        assert len(result) == 5
        assert result[1] == {"role": "user", "content": "[Pro Regulation]: A0"}
        assert result[2] == {"role": "assistant", "content": "B1"}
        assert result[3] == {"role": "user", "content": "[Pro Regulation]: A2"}

    def test_topic_quoted_in_context(self):
        result = build_agent_input(TOPIC, [], "a", "A", "B")
        assert f'"{TOPIC}"' in result[0]["content"]


# ---------------------------------------------------------------------------
# classify_error
# ---------------------------------------------------------------------------


class TestClassifyError:
    def _make_exc(self, cls_name: str, module: str, message: str = "err") -> Exception:
        exc_cls = type(cls_name, (Exception,), {"__module__": module})
        return exc_cls(message)

    def test_authentication_error(self):
        result = classify_error(self._make_exc("AuthenticationError", "openai"))
        assert result["code"] == "invalid_api_key"
        assert result["provider"] == "openai"
        assert result["recoverable"] is True

    def test_rate_limit_error(self):
        result = classify_error(self._make_exc("RateLimitError", "openai"))
        assert result["code"] == "rate_limited"
        assert result["recoverable"] is True

    def test_not_found_error(self):
        result = classify_error(self._make_exc("NotFoundError", "openai"))
        assert result["code"] == "model_not_found"
        assert result["recoverable"] is False

    def test_generic_api_error(self):
        result = classify_error(self._make_exc("APIError", "openai"))
        assert result["code"] == "provider_error"
        assert result["recoverable"] is True

    def test_anthropic_provider_detection(self):
        result = classify_error(self._make_exc("AuthenticationError", "litellm.exceptions"))
        assert result["provider"] == "anthropic"

    def test_unknown_exception(self):
        result = classify_error(RuntimeError("something broke"))
        assert result["code"] == "internal_error"
        assert result["provider"] == "unknown"
        assert result["recoverable"] is True


# ---------------------------------------------------------------------------
# get_turn_agent_info
# ---------------------------------------------------------------------------


class TestGetTurnAgentInfo:
    def test_even_turn_is_agent_a(self):
        info = get_turn_agent_info(_fake_debate(), 0)
        assert info["agent_side"] == "a"
        assert info["agent_name"] == "Pro Regulation"
        assert info["other_agent_name"] == "Free Market"

    def test_odd_turn_is_agent_b(self):
        info = get_turn_agent_info(_fake_debate(), 1)
        assert info["agent_side"] == "b"
        assert info["agent_name"] == "Free Market"
        assert info["other_agent_name"] == "Pro Regulation"

    def test_turn_4_is_agent_a(self):
        assert get_turn_agent_info(_fake_debate(), 4)["agent_side"] == "a"

    def test_turn_5_is_agent_b(self):
        assert get_turn_agent_info(_fake_debate(), 5)["agent_side"] == "b"


# ---------------------------------------------------------------------------
# stream_turn (integration tests against test DB with mocked Agent SDK)
# ---------------------------------------------------------------------------


def _make_delta_event(delta_text: str):
    """Create a mock that passes isinstance(obj, ResponseTextDeltaEvent)."""
    mock = MagicMock(spec=ResponseTextDeltaEvent)
    mock.delta = delta_text
    return mock


def _mock_streamed_result(chunks: list[str]):
    """Build a mock Runner.run_streamed result that yields text delta events."""

    async def stream_events():
        for chunk in chunks:
            yield SimpleNamespace(
                type="raw_response_event",
                data=_make_delta_event(chunk),
            )

    result = MagicMock()
    result.stream_events = stream_events
    result.new_items = []
    return result


class TestStreamTurn:
    """Tests for the stream_turn async generator with mocked Agent SDK."""

    @pytest_asyncio.fixture
    async def debate_and_db(self, db_session):
        user = User(email="test@example.com", name="Test User")
        db_session.add(user)
        await db_session.flush()

        debate = Debate(
            user_id=user.id,
            topic=TOPIC,
            agent_a_config=AGENT_A_CONFIG,
            agent_b_config=AGENT_B_CONFIG,
            status="running",
            current_turn=0,
            max_turns=6,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)
        return debate, db_session

    @pytest.mark.asyncio
    async def test_happy_path_first_turn(self, debate_and_db):
        debate, db = debate_and_db
        chunks = ["Hello ", "world ", "argument."]

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=_mock_streamed_result(chunks),
        ), patch("app.services.debate_orchestrator.create_agent"):
            events = []
            async for sse in stream_turn(debate, [], "fake-key", db):
                events.append(sse)

        assert len(events) == 5
        assert events[0].event == "turn_start"
        assert events[1].event == "token"
        assert events[2].event == "token"
        assert events[3].event == "token"
        assert events[4].event == "turn_complete"

        await db.refresh(debate)
        assert debate.current_turn == 1
        assert debate.status == "running"

        saved_turn = (
            await db.execute(select(Turn).where(Turn.debate_id == debate.id))
        ).scalar_one()
        assert saved_turn.turn_number == 0
        assert saved_turn.agent_side == "a"
        assert saved_turn.content == "Hello world argument."

    @pytest.mark.asyncio
    async def test_debate_completes_on_last_turn(self, debate_and_db):
        debate, db = debate_and_db
        debate.current_turn = 5
        debate.max_turns = 6
        await db.commit()
        await db.refresh(debate)

        # Pre-populate 5 turns
        for i in range(5):
            side = "a" if i % 2 == 0 else "b"
            name = AGENT_A_CONFIG["name"] if side == "a" else AGENT_B_CONFIG["name"]
            model = AGENT_A_CONFIG["model"] if side == "a" else AGENT_B_CONFIG["model"]
            db.add(Turn(
                debate_id=debate.id,
                turn_number=i,
                agent_name=name,
                agent_side=side,
                content=f"Turn {i} content",
                model_used=model,
            ))
        await db.commit()

        existing_turns = (
            await db.execute(
                select(Turn).where(Turn.debate_id == debate.id).order_by(Turn.turn_number)
            )
        ).scalars().all()

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=_mock_streamed_result(["Final."]),
        ), patch("app.services.debate_orchestrator.create_agent"):
            events = []
            async for sse in stream_turn(debate, existing_turns, "fake-key", db):
                events.append(sse)

        await db.refresh(debate)
        assert debate.status == "completed"
        assert debate.current_turn == 6

    @pytest.mark.asyncio
    async def test_error_pauses_debate(self, debate_and_db):
        debate, db = debate_and_db

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            side_effect=RuntimeError("Agent blew up"),
        ), patch("app.services.debate_orchestrator.create_agent"):
            events = []
            async for sse in stream_turn(debate, [], "fake-key", db):
                events.append(sse)

        assert len(events) == 2
        assert events[0].event == "turn_start"
        assert events[1].event == "error"

        await db.refresh(debate)
        assert debate.status == "paused"
        assert debate.current_turn == 0

    @pytest.mark.asyncio
    async def test_fallback_to_new_items(self, debate_and_db):
        debate, db = debate_and_db

        mock_item = MagicMock(spec=MessageOutputItem)

        async def empty_stream():
            return
            yield  # noqa: makes this an async generator

        result = MagicMock()
        result.stream_events = empty_stream
        result.new_items = [mock_item]

        with patch(
            "app.services.debate_orchestrator.Runner.run_streamed",
            return_value=result,
        ), patch("app.services.debate_orchestrator.create_agent"), patch(
            "app.services.debate_orchestrator.ItemHelpers.text_message_output",
            return_value="Fallback content here.",
        ):
            events = []
            async for sse in stream_turn(debate, [], "fake-key", db):
                events.append(sse)

        assert len(events) == 2
        assert events[0].event == "turn_start"
        assert events[1].event == "turn_complete"

        saved = (
            await db.execute(select(Turn).where(Turn.debate_id == debate.id))
        ).scalar_one()
        assert saved.content == "Fallback content here."
