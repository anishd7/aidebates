"""SSE event formatting helpers for debate streaming.

Provides helper functions that create ServerSentEvent objects for the
debate streaming protocol: turn_start, token, turn_complete, and error events.
"""

import json
from sse_starlette.sse import ServerSentEvent


def _json_data(payload: dict) -> str:
    """Serialize a dict to compact JSON for SSE data field."""
    return json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def turn_start_event(
    turn: int,
    agent_name: str,
    agent_side: str,
    model: str,
) -> ServerSentEvent:
    """Create a turn_start SSE event.

    Emitted at the beginning of a turn before any tokens are streamed.
    """
    return ServerSentEvent(
        data=_json_data({
            "turn": turn,
            "agent_name": agent_name,
            "agent_side": agent_side,
            "model": model,
        }),
        event="turn_start",
    )


def token_event(text: str) -> ServerSentEvent:
    """Create a token SSE event.

    Emitted for each streaming text delta during a turn.
    """
    return ServerSentEvent(
        data=_json_data({"text": text}),
        event="token",
    )


def turn_complete_event(
    turn: int,
    agent_name: str,
    content: str,
    debate_status: str,
    current_turn: int,
) -> ServerSentEvent:
    """Create a turn_complete SSE event.

    Emitted after a turn has been fully streamed and saved to the database.
    """
    return ServerSentEvent(
        data=_json_data({
            "turn": turn,
            "agent_name": agent_name,
            "content": content,
            "debate_status": debate_status,
            "current_turn": current_turn,
        }),
        event="turn_complete",
    )


def error_event(
    code: str,
    provider: str,
    message: str,
    recoverable: bool,
) -> ServerSentEvent:
    """Create an error SSE event.

    Emitted when an error occurs during turn generation. The debate is
    typically paused after an error so the user can fix the issue and resume.
    """
    return ServerSentEvent(
        data=_json_data({
            "code": code,
            "provider": provider,
            "message": message,
            "recoverable": recoverable,
        }),
        event="error",
    )
