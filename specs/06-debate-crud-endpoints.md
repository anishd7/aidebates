# Component: Debate CRUD Endpoints

## Overview
REST endpoints for creating, listing, and retrieving debates. Handles both authenticated (owner) and unauthenticated (public shared) access patterns.

## What It Does
- `POST /api/v1/debates` — Create a new debate with topic and agent configs
- `GET /api/v1/debates` — List authenticated user's debates (paginated)
- `GET /api/v1/debates/{id}` — Get debate with full turn history (auth or public)

## Files to Create
- `backend/app/routers/debates.py` — route handlers
- `backend/app/schemas/debates.py` — Pydantic request/response schemas
- `backend/app/schemas/turns.py` — Turn response schema

## Dependencies
- Component `01-database-models` (Debate, Turn, UserApiKey models)
- Component `02-backend-config` (FastAPI app)
- Component `05-auth-middleware` (`get_current_user`, `get_optional_user`)

## Pydantic Schemas

### Request: `AgentConfigInput`
```
{
  "name": str,          # max 100 chars
  "personality": str,   # max 1000 chars
  "provider": str,      # "openai" or "anthropic"
  "model": str          # model identifier string
}
```

### Request: `CreateDebateRequest`
```
{
  "topic": str,                # max 2000 chars
  "agent_a": AgentConfigInput,
  "agent_b": AgentConfigInput,
  "max_turns": int = 100       # 2-100
}
```

### Response: `DebateResponse` (full detail)
```
{
  "id": str,
  "topic": str,
  "agent_a_config": dict,
  "agent_b_config": dict,
  "status": str,
  "current_turn": int,
  "max_turns": int,
  "turns": list[TurnResponse],
  "created_at": datetime,
  "updated_at": datetime
}
```

### Response: `DebateListItem`
```
{
  "id": str,
  "topic": str,
  "status": str,
  "current_turn": int,
  "max_turns": int,
  "agent_a_name": str,
  "agent_b_name": str,
  "created_at": datetime,
  "updated_at": datetime
}
```

### Response: `DebateListResponse`
```
{
  "debates": list[DebateListItem],
  "total": int,
  "limit": int,
  "offset": int
}
```

### Response: `TurnResponse`
```
{
  "turn_number": int,
  "agent_name": str,
  "agent_side": str,
  "content": str,
  "model_used": str,
  "created_at": datetime
}
```

## Endpoint Details

### `POST /api/v1/debates`
- **Auth**: Required
- **Input**: `CreateDebateRequest` body
- **Behavior**:
  1. Validate all fields (see validation rules below)
  2. Check that user has API keys for the providers referenced by agent_a and agent_b (query `user_api_keys` — existence check only, not validity)
  3. Insert debate row with `status='created'`, `current_turn=0`
  4. Return the created debate
- **Output**: 201 with `DebateResponse` (empty turns list)
- **Errors**: 400 if validation fails, 400 if missing required provider keys

### `GET /api/v1/debates`
- **Auth**: Required
- **Query params**: `status` (optional filter), `limit` (default 50, max 100), `offset` (default 0)
- **Behavior**: Query debates for the authenticated user, ordered by `created_at DESC`
- **Output**: 200 with `DebateListResponse`

### `GET /api/v1/debates/{id}`
- **Auth**: Optional (uses `get_optional_user`)
- **Behavior**:
  - If authenticated and user owns the debate: return full debate with all turns
  - If unauthenticated (or not owner) and debate `status == 'completed'`: return full debate with turns (public share)
  - Otherwise: 404
- **Output**: 200 with `DebateResponse` (turns ordered by `turn_number ASC`)

## Validation Rules (Create)
- `topic`: non-empty, max 2000 characters
- `agent_a.name` / `agent_b.name`: non-empty, max 100 characters
- `agent_a.personality` / `agent_b.personality`: non-empty, max 1000 characters
- `provider`: must be `"openai"` or `"anthropic"`
- `model`: non-empty string (not validated against provider — provider will reject invalid models)
- `max_turns`: integer between 2 and 100 inclusive

## Behavior & Constraints
- Debate IDs are UUIDs, also used as share URLs
- The `agent_a_config` and `agent_b_config` JSONB columns store the full `AgentConfigInput` dict
- `DebateListItem` extracts `agent_a_name` and `agent_b_name` from the JSONB configs for display
- Turns are only included in the single-debate response, not the list
- The provider key existence check (step 2 of create) queries `user_api_keys` for the user — it does NOT decrypt or validate the key

## Relevant Skills
- `fastapi` — route handlers, query params, path params
- `python` — Pydantic validation, SQLAlchemy queries

### Recommended skills.sh Skills
- **fastapi-templates** — production-ready FastAPI project structure with route handlers, Pydantic schemas, and service layer patterns
  ```bash
  npx skills add https://github.com/wshobson/agents --skill fastapi-templates
  ```
- **api-design-principles** — REST API design covering pagination, filtering, error handling, and consistent status codes
  ```bash
  npx skills add https://github.com/wshobson/agents --skill api-design-principles
  ```
- **async-python-patterns** — async database query patterns for SQLAlchemy async sessions
  ```bash
  npx skills add https://github.com/wshobson/agents --skill async-python-patterns
  ```

## Tests to Validate
- **Create debate**: Valid request returns 201 with correct fields and `status='created'`
- **Validation**: Missing topic returns 400
- **Validation**: `max_turns=0` returns 400, `max_turns=101` returns 400
- **Validation**: Invalid provider returns 400
- **Missing provider key**: Creating a debate with provider "anthropic" when user has no Anthropic key returns 400
- **List debates**: Returns user's debates ordered by most recent, with pagination
- **List with filter**: `?status=completed` returns only completed debates
- **Get own debate**: Returns full debate with turns
- **Get shared debate**: Unauthenticated request for a completed debate returns 200
- **Get private debate**: Unauthenticated request for a non-completed debate returns 404
- **Get non-existent**: Returns 404
- **Isolation**: User A cannot see User B's debates in list or by ID (unless completed/shared)
