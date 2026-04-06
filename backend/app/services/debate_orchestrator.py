"""Debate orchestration service.

Core logic for running a single debate turn: conversation reconstruction,
streaming via the OpenAI Agents SDK, error classification, and atomic
persistence of the completed turn.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from agents import Runner
from agents.items import ItemHelpers, MessageOutputItem
from openai.types.responses import ResponseTextDeltaEvent
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import ServerSentEvent

from app.models.debate import Debate
from app.models.turn import Turn
from app.services.agent_factory import create_agent
from app.utils.sse import error_event, token_event, turn_complete_event, turn_start_event

logger = logging.getLogger(__name__)


def build_agent_input(
    topic: str,
    turns: list[Turn],
    current_agent_side: str,
    current_agent_name: str,
    other_agent_name: str,
) -> list[dict[str, str]]:
    """Reconstruct conversation history from the current agent's perspective.

    For the first turn (no existing turns), returns a single user message with
    the topic and opening argument prompt.

    For subsequent turns, returns:
      1. A context message with the topic
      2. Each previous turn mapped to the correct role:
         - Current agent's turns → "assistant"
         - Opponent's turns → "user" with name prefix
      3. A closing prompt asking for the next argument

    Args:
        topic: The debate topic.
        turns: All existing turns in order.
        current_agent_side: "a" or "b" — the side of the agent about to speak.
        current_agent_name: Display name of the current agent.
        other_agent_name: Display name of the opponent agent.

    Returns:
        List of message dicts with "role" and "content" keys.
    """
    if not turns:
        return [
            {
                "role": "user",
                "content": (
                    f'The debate topic is: "{topic}"\n\n'
                    "Please present your opening argument."
                ),
            }
        ]

    messages: list[dict[str, str]] = [
        {
            "role": "user",
            "content": (
                f'The debate topic is: "{topic}"\n\n'
                "The debate has begun. Here is the conversation so far."
            ),
        }
    ]

    for turn in turns:
        if turn.agent_side == current_agent_side:
            messages.append({"role": "assistant", "content": turn.content})
        else:
            messages.append(
                {"role": "user", "content": f"[{other_agent_name}]: {turn.content}"}
            )

    messages.append({"role": "user", "content": "Please respond with your next argument."})
    return messages


def classify_error(exc: Exception) -> dict[str, Any]:
    """Classify an exception into an error code, provider hint, and recoverability.

    Returns a dict with keys: code, provider, message, recoverable.
    """
    exc_type = type(exc).__name__
    message = str(exc)

    if exc_type == "AuthenticationError":
        return {
            "code": "invalid_api_key",
            "provider": _provider_from_exception(exc),
            "message": message,
            "recoverable": True,
        }
    if exc_type == "RateLimitError":
        return {
            "code": "rate_limited",
            "provider": _provider_from_exception(exc),
            "message": message,
            "recoverable": True,
        }
    if exc_type == "NotFoundError":
        return {
            "code": "model_not_found",
            "provider": _provider_from_exception(exc),
            "message": message,
            "recoverable": False,
        }
    # Generic API errors from openai / litellm
    if "APIError" in exc_type or "ApiError" in exc_type:
        return {
            "code": "provider_error",
            "provider": _provider_from_exception(exc),
            "message": message,
            "recoverable": True,
        }

    return {
        "code": "internal_error",
        "provider": "unknown",
        "message": message,
        "recoverable": True,
    }


def _provider_from_exception(exc: Exception) -> str:
    """Best-effort extraction of the provider name from an SDK exception."""
    module = type(exc).__module__ or ""
    if "openai" in module:
        return "openai"
    if "anthropic" in module or "litellm" in module:
        return "anthropic"
    return "unknown"


def get_turn_agent_info(debate: Debate, turn_number: int) -> dict[str, Any]:
    """Determine which agent speaks for the given turn number.

    Returns a dict with: agent_config, agent_side, agent_name, other_agent_name,
    other_agent_config.
    """
    if turn_number % 2 == 0:
        return {
            "agent_config": debate.agent_a_config,
            "agent_side": "a",
            "agent_name": debate.agent_a_config["name"],
            "other_agent_name": debate.agent_b_config["name"],
            "other_agent_config": debate.agent_b_config,
        }
    return {
        "agent_config": debate.agent_b_config,
        "agent_side": "b",
        "agent_name": debate.agent_b_config["name"],
        "other_agent_name": debate.agent_a_config["name"],
        "other_agent_config": debate.agent_a_config,
    }


async def _pause_debate(db: AsyncSession, debate_id: uuid.UUID) -> None:
    """Set debate status to paused, handling any session state issues."""
    try:
        await db.rollback()
    except Exception:
        pass
    try:
        await db.execute(
            update(Debate)
            .where(Debate.id == debate_id)
            .values(status="paused")
        )
        await db.commit()
    except Exception:
        logger.exception("Failed to pause debate %s after error", debate_id)


async def stream_turn(
    debate: Debate,
    turns: list[Turn],
    api_key: str,
    db: AsyncSession,
) -> AsyncGenerator[ServerSentEvent, None]:
    """Generate a single debate turn via streaming and persist the result.

    This is an async generator that yields ServerSentEvent objects suitable for
    an EventSourceResponse. It:
      1. Emits a turn_start event
      2. Streams tokens from the agent
      3. Saves the turn and increments current_turn atomically
      4. Emits a turn_complete event
      5. On error: pauses the debate and emits an error event

    Args:
        debate: The Debate ORM instance (must be attached to a session).
        turns: Existing turns for the debate, ordered by turn_number.
        api_key: Decrypted API key for the current agent's provider.
        db: An async DB session for persistence.

    Yields:
        ServerSentEvent objects for the SSE response.
    """
    turn_number = debate.current_turn
    agent_info = get_turn_agent_info(debate, turn_number)
    agent_config = agent_info["agent_config"]
    agent_side = agent_info["agent_side"]
    agent_name = agent_info["agent_name"]
    other_agent_name = agent_info["other_agent_name"]
    model_name = agent_config["model"]

    # Emit turn_start
    yield turn_start_event(
        turn=turn_number,
        agent_name=agent_name,
        agent_side=agent_side,
        model=model_name,
    )

    try:
        # Build conversation input
        conversation = build_agent_input(
            topic=debate.topic,
            turns=turns,
            current_agent_side=agent_side,
            current_agent_name=agent_name,
            other_agent_name=other_agent_name,
        )

        # Create agent and run streamed
        agent = create_agent(agent_config, api_key)
        result = Runner.run_streamed(agent, input=conversation)

        accumulated_text = ""
        async for event in result.stream_events():
            if event.type == "raw_response_event" and isinstance(
                event.data, ResponseTextDeltaEvent
            ):
                delta = event.data.delta
                if delta:
                    accumulated_text += delta
                    yield token_event(delta)

        # Fallback: if no tokens were extracted via streaming, use result.new_items
        if not accumulated_text:
            for item in result.new_items:
                if isinstance(item, MessageOutputItem):
                    accumulated_text = ItemHelpers.text_message_output(item)
                    break

        if not accumulated_text:
            raise RuntimeError("Agent produced no output for this turn")

        # Atomic save: insert turn + increment current_turn
        new_turn = Turn(
            debate_id=debate.id,
            turn_number=turn_number,
            agent_name=agent_name,
            agent_side=agent_side,
            content=accumulated_text,
            model_used=model_name,
        )
        db.add(new_turn)

        new_current_turn = turn_number + 1
        new_status = "completed" if new_current_turn >= debate.max_turns else "running"

        await db.execute(
            update(Debate)
            .where(Debate.id == debate.id)
            .values(current_turn=new_current_turn, status=new_status)
        )
        await db.commit()

        yield turn_complete_event(
            turn=turn_number,
            agent_name=agent_name,
            content=accumulated_text,
            debate_status=new_status,
            current_turn=new_current_turn,
        )

    except Exception as exc:
        logger.exception("Error during turn %d of debate %s", turn_number, debate.id)

        # Pause the debate
        await _pause_debate(db, debate.id)

        error_info = classify_error(exc)
        yield error_event(
            code=error_info["code"],
            provider=error_info["provider"],
            message=error_info["message"],
            recoverable=error_info["recoverable"],
        )
