# Component: Debate Orchestrator & Next-Turn Endpoint

## Overview
The core backend logic: the `POST /api/v1/debates/{id}/next-turn` endpoint that generates one debate turn, streams it via SSE, and saves it to the database. Includes conversation reconstruction, streaming, error handling, and optimistic concurrency control.

## What It Does
- Determines which agent speaks next based on `current_turn % 2`
- Validates the required API key is provided for that agent's provider
- Reconstructs the conversation history from the agent's perspective
- Creates an Agent via the agent factory and runs `Runner.run_streamed()`
- Streams tokens to the client via SSE (Server-Sent Events)
- After streaming completes, saves the turn and increments `current_turn` atomically
- Handles errors by pausing the debate and emitting error events

## Files to Create
- `backend/app/services/debate_orchestrator.py` — core orchestration logic
- `backend/app/routers/turns.py` — the next-turn endpoint (or add to `routers/debates.py`)
- `backend/app/utils/__init__.py`
- `backend/app/utils/sse.py` — SSE event formatting helpers

## Dependencies
- `sse-starlette>=2.0`
- `httpx>=0.27`
- Component `01-database-models` (Debate, Turn models)
- Component `02-backend-config` (FastAPI app)
- Component `05-auth-middleware` (`get_current_user`)
- Component `07-agent-factory` (`create_agent`)

## Inputs
- **Path param**: `debate_id: UUID`
- **Headers**:
  - `Authorization: Bearer <jwt>` (required)
  - `X-OpenAI-Key: <key>` (required if this turn's agent uses OpenAI)
  - `X-Anthropic-Key: <key>` (required if this turn's agent uses Anthropic)
- **No request body**

## Outputs
- SSE stream (`Content-Type: text/event-stream`) with events: `turn_start`, `token`, `turn_complete`, `error`
- Or HTTP status codes: 204 (debate complete), 400, 401, 404, 409

## Endpoint Logic (Critical Path)

### `POST /api/v1/debates/{id}/next-turn`

```
1. Read debate state (no DB lock)
   - If not found or not owned by user → 404
   - If current_turn >= max_turns → set status='completed', return 204

2. Check if turn already exists in turns table
   - If turn with this turn_number exists → 409 (another request completed it)

3. Determine which agent speaks: turn_number % 2 == 0 → agent_a, else → agent_b

4. Validate API key header exists for this agent's provider
   - Missing → 400 with message

5. Load all existing turns from DB, ordered by turn_number

6. Build conversation input from the current agent's perspective
   (see Conversation Reconstruction below)

7. Create Agent via agent_factory.create_agent()

8. Return EventSourceResponse that streams the turn
   - On success: save turn + increment current_turn in ONE transaction
   - On failure: set debate status to 'paused', emit error event
```

### Post-Streaming Save (Atomic Transaction)
After streaming completes successfully:
```sql
BEGIN;
  INSERT INTO turns (debate_id, turn_number, agent_name, agent_side, content, model_used)
    VALUES (...);
  UPDATE debates SET current_turn = current_turn + 1, updated_at = now()
    WHERE id = :debate_id;
COMMIT;
```
The `UNIQUE(debate_id, turn_number)` constraint prevents duplicate inserts if two requests race.

## Conversation Reconstruction

### `build_agent_input(topic, turns, current_agent_side, current_agent_name, other_agent_name) -> list[dict]`

**First turn (no existing turns):**
```json
[
  {"role": "user", "content": "The debate topic is: \"<topic>\"\n\nPlease present your opening argument."}
]
```

**Subsequent turns:**
```json
[
  {"role": "user", "content": "The debate topic is: \"<topic>\"\n\nThe debate has begun. Here is the conversation so far."},
  // For each previous turn:
  //   If turn.agent_side == current_agent_side → {"role": "assistant", "content": turn.content}
  //   Else → {"role": "user", "content": "[<other_agent_name>]: <turn.content>"}
  {"role": "user", "content": "Please respond with your next argument."}
]
```

**Key rule**: The current agent's own previous messages are `"assistant"` role. The opponent's messages are `"user"` role with a name prefix. This ensures each agent perceives the conversation from its own perspective.

## SSE Event Protocol

### `turn_start`
```json
{"turn": 0, "agent_name": "Pro Regulation", "agent_side": "a", "model": "gpt-4.1"}
```

### `token` (high frequency)
```json
{"text": "I "}
```

### `turn_complete`
```json
{"turn": 0, "agent_name": "Pro Regulation", "content": "full text...", "debate_status": "running", "current_turn": 1}
```

### `error`
```json
{"code": "invalid_api_key", "provider": "openai", "message": "...", "recoverable": true}
```

## Error Classification

### `classify_error(e: Exception) -> dict`
| Exception Type        | Code              | Recoverable |
|-----------------------|-------------------|-------------|
| `AuthenticationError` | `invalid_api_key` | true        |
| `RateLimitError`      | `rate_limited`    | true        |
| `NotFoundError`       | `model_not_found` | false       |
| `APIError` (generic)  | `provider_error`  | true        |
| Any other             | `internal_error`  | true        |

On error:
1. Emit `error` SSE event
2. Set debate `status = 'paused'`
3. Do NOT save a turn, do NOT increment `current_turn`

## Streaming Implementation

```python
from agents import Runner
from openai.types.responses import ResponseTextDeltaEvent

result = Runner.run_streamed(agent, input=conversation)
async for event in result.stream_events():
    if event.type == "raw_response_event":
        if isinstance(event.data, ResponseTextDeltaEvent):
            delta = event.data.delta
            # yield as SSE token event

# Fallback: if no tokens extracted from streaming, get from result.new_items
for item in result.new_items:
    if isinstance(item, MessageOutputItem):
        text = ItemHelpers.text_message_output(item)
```

## Behavior & Constraints
- The backend is stateless — no in-memory tracking of active debates
- The `current_turn` is only incremented AFTER the turn is saved (revised design for crash safety)
- If the server crashes mid-stream, `current_turn` is unchanged, and retry generates the same turn
- The `UNIQUE(debate_id, turn_number)` constraint is the ultimate guard against duplicate turns
- SSE events must be valid JSON in the `data` field
- The accumulated text from streaming tokens is the canonical turn content saved to DB
- If streaming produces no tokens (edge case), fall back to `result.new_items`

## Relevant Skills
- `fastapi` — SSE streaming with `sse-starlette`
- `python` — OpenAI Agents SDK streaming, async generators
- OpenAI Agents SDK: `Runner.run_streamed()`, `stream_events()`, `ResponseTextDeltaEvent`

### Recommended skills.sh Skills
- **async-python-patterns** — comprehensive async/await guide covering async generators, concurrent I/O, and event loop management; critical for the streaming orchestration logic
  ```bash
  npx skills add https://github.com/wshobson/agents --skill async-python-patterns
  ```
- **fastapi-templates** — production-ready FastAPI patterns including middleware, dependency injection, and error handling
  ```bash
  npx skills add https://github.com/wshobson/agents --skill fastapi-templates
  ```
- **api-design-principles** — REST API design covering error handling with consistent status codes; relevant for the error classification system
  ```bash
  npx skills add https://github.com/wshobson/agents --skill api-design-principles
  ```

## Tests to Validate
- **Happy path**: Generate a turn, verify SSE events (turn_start, tokens, turn_complete) and DB state
- **Turn alternation**: Turn 0 uses agent_a, turn 1 uses agent_b, etc.
- **Conversation reconstruction**: `build_agent_input` produces correct role assignments for each agent's perspective
- **First turn**: First turn sends the topic as opening prompt
- **Subsequent turn**: Later turns include reconstructed conversation history
- **Debate completion**: When `current_turn >= max_turns`, returns 204 and sets status to 'completed'
- **Missing API key**: Request without required provider key header returns 400
- **Duplicate turn**: Concurrent request for same turn returns 409 (via UNIQUE constraint)
- **Error handling**: Provider `AuthenticationError` emits error event and pauses debate
- **Crash recovery**: If turn is not saved (simulated crash), `current_turn` is unchanged and retry works
- **Atomic save**: Turn insert and `current_turn` increment happen in one transaction
- **Ownership**: User cannot generate turns for another user's debate
