"""Tests for SSE event formatting helpers."""

import json

from app.utils.sse import (
    turn_start_event,
    token_event,
    turn_complete_event,
    error_event,
)
from sse_starlette.sse import ServerSentEvent


def _decode_event(sse: ServerSentEvent) -> tuple[str, dict]:
    """Decode a ServerSentEvent into (event_name, parsed_data)."""
    raw = sse.encode().decode("utf-8")
    event_name = None
    data_lines = []
    for line in raw.strip().split("\r\n"):
        if line.startswith("event: "):
            event_name = line[len("event: "):]
        elif line.startswith("data: "):
            data_lines.append(line[len("data: "):])
    data = json.loads("".join(data_lines))
    return event_name, data


class TestTurnStartEvent:
    def test_event_type_and_fields(self):
        sse = turn_start_event(
            turn=0,
            agent_name="Pro Regulation",
            agent_side="a",
            model="gpt-4.1",
        )
        assert isinstance(sse, ServerSentEvent)
        event_name, data = _decode_event(sse)
        assert event_name == "turn_start"
        assert data == {
            "turn": 0,
            "agent_name": "Pro Regulation",
            "agent_side": "a",
            "model": "gpt-4.1",
        }

    def test_agent_b_side(self):
        sse = turn_start_event(turn=1, agent_name="Anti Regulation", agent_side="b", model="claude-sonnet-4-20250514")
        _, data = _decode_event(sse)
        assert data["agent_side"] == "b"
        assert data["turn"] == 1


class TestTokenEvent:
    def test_single_word(self):
        sse = token_event("Hello")
        event_name, data = _decode_event(sse)
        assert event_name == "token"
        assert data == {"text": "Hello"}

    def test_whitespace_preserved(self):
        sse = token_event("I ")
        _, data = _decode_event(sse)
        assert data["text"] == "I "

    def test_empty_string(self):
        sse = token_event("")
        _, data = _decode_event(sse)
        assert data["text"] == ""

    def test_unicode_text(self):
        sse = token_event("résumé naïve")
        _, data = _decode_event(sse)
        assert data["text"] == "résumé naïve"

    def test_special_characters(self):
        sse = token_event('He said "hello" & <goodbye>')
        _, data = _decode_event(sse)
        assert data["text"] == 'He said "hello" & <goodbye>'


class TestTurnCompleteEvent:
    def test_event_type_and_fields(self):
        sse = turn_complete_event(
            turn=0,
            agent_name="Pro Regulation",
            content="Full argument text here.",
            debate_status="running",
            current_turn=1,
        )
        event_name, data = _decode_event(sse)
        assert event_name == "turn_complete"
        assert data == {
            "turn": 0,
            "agent_name": "Pro Regulation",
            "content": "Full argument text here.",
            "debate_status": "running",
            "current_turn": 1,
        }

    def test_completed_status(self):
        sse = turn_complete_event(
            turn=5,
            agent_name="Agent B",
            content="Final words.",
            debate_status="completed",
            current_turn=6,
        )
        _, data = _decode_event(sse)
        assert data["debate_status"] == "completed"
        assert data["current_turn"] == 6


class TestErrorEvent:
    def test_recoverable_error(self):
        sse = error_event(
            code="invalid_api_key",
            provider="openai",
            message="Incorrect API key provided.",
            recoverable=True,
        )
        event_name, data = _decode_event(sse)
        assert event_name == "error"
        assert data == {
            "code": "invalid_api_key",
            "provider": "openai",
            "message": "Incorrect API key provided.",
            "recoverable": True,
        }

    def test_non_recoverable_error(self):
        sse = error_event(
            code="model_not_found",
            provider="anthropic",
            message="Model does not exist.",
            recoverable=False,
        )
        _, data = _decode_event(sse)
        assert data["recoverable"] is False
        assert data["code"] == "model_not_found"

    def test_rate_limited(self):
        sse = error_event(
            code="rate_limited",
            provider="openai",
            message="Rate limit exceeded. Please retry.",
            recoverable=True,
        )
        _, data = _decode_event(sse)
        assert data["code"] == "rate_limited"
        assert data["recoverable"] is True


class TestJsonEncoding:
    def test_no_extra_whitespace(self):
        """SSE data should use compact JSON (no spaces after separators)."""
        sse = token_event("hi")
        raw = sse.encode().decode("utf-8")
        # Extract the data line
        for line in raw.strip().split("\r\n"):
            if line.startswith("data: "):
                assert line == 'data: {"text":"hi"}'
                break

    def test_newlines_in_content(self):
        """Content with newlines should be properly JSON-encoded."""
        sse = turn_complete_event(
            turn=0,
            agent_name="Agent",
            content="Line 1\nLine 2\nLine 3",
            debate_status="running",
            current_turn=1,
        )
        event_name, data = _decode_event(sse)
        assert data["content"] == "Line 1\nLine 2\nLine 3"
