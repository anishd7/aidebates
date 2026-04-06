---
name: AI Debate Arena
overview: Full architecture plan for a web application where two AI agents (powered by configurable models via the OpenAI Agents SDK) debate a user-submitted topic in real-time, with streamed responses, persistent conversation history, crash recovery, and a Claude.ai-inspired UI.
todos:
  - id: backend-core
    content: "Build FastAPI backend: project structure, config, database models, auth middleware, API endpoints for keys/debates/turns"
    status: pending
  - id: debate-engine
    content: "Implement debate orchestration engine: agent factory (OpenAI + LiteLLM), conversation reconstruction, SSE streaming, error handling"
    status: pending
  - id: database
    content: "Set up PostgreSQL schema with Base.metadata.create_all(): users, user_api_keys, debates, turns tables with indexes and constraints"
    status: pending
  - id: frontend-shell
    content: "Build Next.js frontend: project setup, shadcn/ui, NextAuth with Google OAuth, app shell with Claude.ai-style sidebar layout"
    status: pending
  - id: frontend-debate
    content: "Implement debate UI: CreateDebateForm, DebateView with streaming messages, DebateManager Zustand store with client-side loop"
    status: pending
  - id: frontend-settings
    content: "Build settings page: API key management (add/update/delete), key fetch and caching in memory"
    status: pending
  - id: resume-and-sharing
    content: Implement crash recovery (resume from DB state), completed debate sharing via public URLs
    status: pending
  - id: deployment
    content: "Deploy to Railway: frontend service, backend service, managed Postgres, custom domain, environment variables, CORS"
    status: pending
  - id: local-dev
    content: "Set up local development: Docker Compose for Postgres, .env templates, README with setup instructions"
    status: pending
isProject: false
---

# AI Debate Arena - Full Architecture Plan

## 1. Overview

A web application where users configure two AI agents (each backed by a different LLM) and watch them debate a topic in real time. The user submits a debate topic, selects a model and personality for each agent, and the app orchestrates a turn-by-turn debate streamed live to the browser.

**Core constraints:**

- Maximum 100 total turns per debate (50 per agent)
- Each agent can be backed by any supported model (OpenAI GPT-series, Anthropic Claude via LiteLLM)
- Users bring their own API keys (BYOK)
- Debates are persistent (Postgres), resumable after crashes, and shareable when completed
- The debate loop is client-driven (one API call per turn), making the backend stateless and horizontally scalable

---

## 2. System Architecture

```mermaid
flowchart TB
    subgraph browser ["Browser (Next.js SPA)"]
        Landing["Landing Page\n(public, SEO)"]
        App["Main App\n(authenticated)"]
        DM["DebateManager\n(Zustand store)"]
        Loop1["Debate Loop 1"]
        Loop2["Debate Loop 2"]
        Cache["API Keys\n(in-memory cache)"]
        
        App --> DM
        DM --> Loop1
        DM --> Loop2
        DM --> Cache
    end

    subgraph backend ["Backend (FastAPI on Railway)"]
        API["FastAPI Server\n(stateless, async)"]
        AuthMW["JWT Auth\nMiddleware"]
        Orchestrator["Debate Orchestrator\n(per-turn)"]
        AgentFactory["Agent Factory\n(OpenAI Agents SDK)"]
        
        API --> AuthMW
        AuthMW --> Orchestrator
        Orchestrator --> AgentFactory
    end

    subgraph providers ["Model Providers"]
        OpenAI["OpenAI API\n(GPT-4o, GPT-4.1, GPT-5)"]
        Anthropic["Anthropic API\n(via LiteLLM)"]
    end

    subgraph data ["Data Layer"]
        PG["PostgreSQL\n(Railway managed)"]
    end

    Loop1 -->|"POST /next-turn\n+ API keys in headers\n(SSE response)"| API
    Loop2 -->|"POST /next-turn\n+ API keys in headers\n(SSE response)"| API
    Cache -->|"GET /keys (once)"| API
    AgentFactory -->|"Runner.run_streamed()"| OpenAI
    AgentFactory -->|"Runner.run_streamed()\nvia LiteLLM"| Anthropic
    API --> PG
```



**Key architectural decisions:**

- **Client-side loop (Approach 2):** The JavaScript client drives the debate by calling `POST /debates/{id}/next-turn` repeatedly. Each call generates one turn, streams it via SSE, saves to DB, then closes. This makes the backend stateless and horizontally scalable.
- **Single machine, multi-provider:** Both agents run on the same server process. The "heavy compute" happens at the model providers' API servers, not locally. The Python server just orchestrates async HTTP calls.
- **BYOK with server-side storage:** API keys are stored encrypted in Postgres, fetched once per session by the frontend, cached in browser memory, and passed as headers with each turn request. The backend never looks up keys from DB during turn generation.

---

## 3. Tech Stack

### Backend

- **Language:** Python 3.11+
- **Framework:** FastAPI (async, SSE support via `StreamingResponse`)
- **ASGI server:** Uvicorn
- **Agent SDK:** `openai-agents` (pip package for the [openai-agents-python](https://github.com/openai/openai-agents-python) repository). This is the OpenAI Agents SDK. Key imports: `Agent`, `Runner`, `OpenAIResponsesModel`, `OpenAIChatCompletionsModel` from the `agents` package.
- **Multi-model support:** `litellm` for Anthropic (translates OpenAI API format to Anthropic format)
- **Database driver:** `asyncpg` (async Postgres driver)
- **ORM:** `SQLAlchemy 2.0` with async support (via `sqlalchemy[asyncio]`)
- **Migrations:** None for MVP. Tables created via `Base.metadata.create_all()` on server startup. Add Alembic later when schema changes are needed on a live database with real data.
- **Encryption:** `cryptography` (Fernet symmetric encryption for API keys at rest)
- **Auth:** JWT validation using `python-jose[cryptography]`
- **Config:** `pydantic-settings` for environment variable management

### Frontend

- **Framework:** Next.js 14+ (App Router)
- **UI library:** shadcn/ui (Radix primitives + Tailwind CSS)
- **Styling:** Tailwind CSS
- **State management:** Zustand (lightweight, perfect for the DebateManager)
- **Auth:** NextAuth.js (Auth.js v5) with Google OAuth provider
- **Markdown rendering:** `react-markdown` (for rendering agent responses that may contain markdown)
- **Icons:** `lucide-react` (included with shadcn/ui)

### Infrastructure

- **Hosting:** Railway (frontend, backend, and Postgres all on one platform)
- **Database:** Railway managed PostgreSQL
- **Domain:** Custom domain via Railway (e.g., `aidebatearena.com` for frontend, `api.aidebatearena.com` for backend)

---

## 4. Database Schema

### 4.1 Tables

`**users`**


| Column       | Type         | Constraints                   | Notes                      |
| ------------ | ------------ | ----------------------------- | -------------------------- |
| `id`         | UUID         | PK, default gen_random_uuid() |                            |
| `email`      | VARCHAR(255) | UNIQUE, NOT NULL              | From OAuth provider        |
| `name`       | VARCHAR(255) |                               | Display name               |
| `avatar_url` | TEXT         |                               | Profile picture from OAuth |
| `created_at` | TIMESTAMPTZ  | NOT NULL, default now()       |                            |
| `updated_at` | TIMESTAMPTZ  | NOT NULL, default now()       |                            |


`**user_api_keys`**


| Column          | Type        | Constraints                   | Notes                         |
| --------------- | ----------- | ----------------------------- | ----------------------------- |
| `id`            | UUID        | PK, default gen_random_uuid() |                               |
| `user_id`       | UUID        | FK -> users(id), NOT NULL     |                               |
| `provider`      | VARCHAR(50) | NOT NULL                      | "openai" or "anthropic"       |
| `encrypted_key` | TEXT        | NOT NULL                      | Fernet-encrypted API key      |
| `key_last_four` | VARCHAR(4)  | NOT NULL                      | Last 4 chars for display      |
| `created_at`    | TIMESTAMPTZ | NOT NULL, default now()       |                               |
| `updated_at`    | TIMESTAMPTZ | NOT NULL, default now()       |                               |
|                 |             | UNIQUE(user_id, provider)     | One key per provider per user |


`**debates`**


| Column           | Type        | Constraints                   | Notes                                                          |
| ---------------- | ----------- | ----------------------------- | -------------------------------------------------------------- |
| `id`             | UUID        | PK, default gen_random_uuid() | Also used as share URL                                         |
| `user_id`        | UUID        | FK -> users(id), NOT NULL     | Debate owner                                                   |
| `topic`          | TEXT        | NOT NULL                      | The debate proposition                                         |
| `agent_a_config` | JSONB       | NOT NULL                      | See Agent Config JSON below                                    |
| `agent_b_config` | JSONB       | NOT NULL                      | See Agent Config JSON below                                    |
| `status`         | VARCHAR(20) | NOT NULL, default 'created'   | created/running/paused/completed                               |
| `current_turn`   | INTEGER     | NOT NULL, default 0           | Next turn number to generate. Used for optimistic concurrency. |
| `max_turns`      | INTEGER     | NOT NULL, default 100         | Maximum total turns                                            |
| `created_at`     | TIMESTAMPTZ | NOT NULL, default now()       |                                                                |
| `updated_at`     | TIMESTAMPTZ | NOT NULL, default now()       |                                                                |


**Agent Config JSON structure** (stored in `agent_a_config` and `agent_b_config`):

```json
{
  "name": "Agent A",
  "personality": "A sharp, analytical debater who relies on data and logic",
  "provider": "openai",
  "model": "gpt-4.1"
}
```

`**turns**`


| Column        | Type         | Constraints                    | Notes                             |
| ------------- | ------------ | ------------------------------ | --------------------------------- |
| `id`          | UUID         | PK, default gen_random_uuid()  |                                   |
| `debate_id`   | UUID         | FK -> debates(id), NOT NULL    |                                   |
| `turn_number` | INTEGER      | NOT NULL                       | 0-indexed                         |
| `agent_name`  | VARCHAR(255) | NOT NULL                       | Agent's display name              |
| `agent_side`  | VARCHAR(1)   | NOT NULL                       | "a" or "b"                        |
| `content`     | TEXT         | NOT NULL                       | Full text of the agent's response |
| `model_used`  | VARCHAR(100) | NOT NULL                       | Actual model string used          |
| `created_at`  | TIMESTAMPTZ  | NOT NULL, default now()        |                                   |
|               |              | UNIQUE(debate_id, turn_number) | Prevents duplicate turns          |


### 4.2 Indexes

- `idx_debates_user_id` on `debates(user_id)` — for listing user's debates
- `idx_debates_status` on `debates(status)` — for finding stale "running" debates
- `idx_turns_debate_id` on `turns(debate_id, turn_number)` — for loading debate history in order
- `idx_user_api_keys_user_id` on `user_api_keys(user_id)` — for key lookups

---

## 5. Backend Server (FastAPI)

### 5.1 Dependencies

`requirements.txt` (or `pyproject.toml`):

```
fastapi>=0.110
uvicorn[standard]>=0.29
sqlalchemy[asyncio]>=2.0
asyncpg>=0.29

openai-agents>=0.1
openai>=1.60
litellm>=1.40
cryptography>=42.0
python-jose[cryptography]>=3.3
pydantic-settings>=2.2
python-dotenv>=1.0
httpx>=0.27
sse-starlette>=2.0
```

Key notes on dependencies:

- `openai-agents` is the pip package for the OpenAI Agents Python SDK (source repo: `openai-agents-python`). It provides `Agent`, `Runner`, `OpenAIResponsesModel`, `OpenAIChatCompletionsModel`, and other classes. Import as `from agents import Agent, Runner` etc.
- `litellm` is required for Anthropic model support. It translates OpenAI-format API calls to Anthropic's format. The Agents SDK has built-in LiteLLM integration via `LitellmModel` from `agents.extensions.models.litellm_provider`.
- `openai` is a dependency of `openai-agents` but listed explicitly for creating per-user `AsyncOpenAI` clients.
- `sse-starlette` provides `EventSourceResponse` for clean SSE streaming in FastAPI.

### 5.2 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, CORS, lifespan
│   ├── config.py               # Pydantic settings (env vars)
│   ├── database.py             # SQLAlchemy async engine, session factory
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── api_key.py
│   │   ├── debate.py
│   │   └── turn.py
│   ├── schemas/                # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── keys.py
│   │   ├── debates.py
│   │   └── turns.py
│   ├── routers/                # FastAPI route handlers
│   │   ├── __init__.py
│   │   ├── keys.py             # /api/v1/keys endpoints
│   │   ├── debates.py          # /api/v1/debates endpoints
│   │   └── health.py           # /api/v1/health
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── debate_orchestrator.py  # Turn generation, streaming
│   │   ├── agent_factory.py        # Agent creation from config
│   │   └── encryption.py           # API key encryption/decryption
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth.py             # JWT validation middleware
│   └── utils/
│       ├── __init__.py
│       └── sse.py              # SSE event formatting helpers
├── requirements.txt
├── Dockerfile
└── .env.example
```

### 5.3 API Endpoints

All endpoints are prefixed with `/api/v1`. Auth-required endpoints validate the JWT from the `Authorization: Bearer <token>` header.

---

#### `GET /api/v1/health`

Health check endpoint. No auth required.

**Response:** `200 OK`

```json
{"status": "healthy", "timestamp": "2026-04-05T12:00:00Z"}
```

---

#### `POST /api/v1/keys`

Save or update an API key for a provider. Auth required.

**Request body:**

```json
{
  "provider": "openai",
  "api_key": "sk-abc123..."
}
```

- `provider`: one of `"openai"`, `"anthropic"`
- `api_key`: the full API key string

**Response:** `200 OK`

```json
{
  "provider": "openai",
  "key_last_four": "c123",
  "updated_at": "2026-04-05T12:00:00Z"
}
```

**Logic:**

1. Validate provider is supported
2. Encrypt the key using Fernet with server-side `ENCRYPTION_KEY`
3. Upsert into `user_api_keys` (insert or update on conflict of `user_id + provider`)
4. Return confirmation with last 4 chars

---

#### `GET /api/v1/keys`

Get all configured API keys for the authenticated user. Auth required.

**Response:** `200 OK`

```json
{
  "keys": [
    {
      "provider": "openai",
      "key_last_four": "c123",
      "updated_at": "2026-04-05T12:00:00Z"
    },
    {
      "provider": "anthropic",
      "key_last_four": "d456",
      "updated_at": "2026-04-05T11:00:00Z"
    }
  ]
}
```

This endpoint returns metadata only (last 4 chars), NOT the full keys. Used for displaying configured providers in the UI.

---

#### `GET /api/v1/keys/decrypt`

Get full decrypted API key values. Auth required. Called once per session by the frontend for caching.

**Response:** `200 OK`

```json
{
  "keys": {
    "openai": "sk-abc123...",
    "anthropic": "sk-ant-def456..."
  }
}
```

**Security:** This endpoint returns sensitive data. It must only be served over HTTPS. The frontend caches these values in React state (not localStorage) and passes them as headers with subsequent requests.

---

#### `DELETE /api/v1/keys/{provider}`

Delete an API key. Auth required.

**Response:** `200 OK`

```json
{"deleted": true, "provider": "openai"}
```

---

#### `POST /api/v1/debates`

Create a new debate. Auth required.

**Request body:**

```json
{
  "topic": "Should artificial intelligence be regulated by governments?",
  "agent_a": {
    "name": "Pro Regulation",
    "personality": "A cautious policy expert who believes in strong governmental oversight of technology",
    "provider": "openai",
    "model": "gpt-4.1"
  },
  "agent_b": {
    "name": "Anti Regulation",
    "personality": "A libertarian technologist who believes innovation thrives without regulation",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "max_turns": 100
}
```

- `max_turns` is optional, defaults to 100

**Response:** `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "topic": "Should artificial intelligence be regulated by governments?",
  "agent_a_config": { ... },
  "agent_b_config": { ... },
  "status": "created",
  "current_turn": 0,
  "max_turns": 100,
  "created_at": "2026-04-05T12:00:00Z"
}
```

**Logic:**

1. Validate that the user has configured the required provider keys (check `user_api_keys` table for the providers referenced in agent_a and agent_b). Do NOT check key validity — just check existence.
2. Insert into `debates` table
3. Return the created debate

**Validation rules:**

- `topic` must be non-empty, max 2000 characters
- `agent_a.name` and `agent_b.name` must be non-empty, max 100 characters
- `agent_a.personality` and `agent_b.personality` must be non-empty, max 1000 characters
- `provider` must be one of: `"openai"`, `"anthropic"`
- `model` must be a non-empty string (the backend does not validate model names — the model provider will return an error if invalid)
- `max_turns` must be between 2 and 100

---

#### `GET /api/v1/debates`

List the authenticated user's debates, ordered by most recent first. Auth required.

**Query params:**

- `status` (optional): filter by status (e.g., `?status=running`)
- `limit` (optional): default 50, max 100
- `offset` (optional): for pagination

**Response:** `200 OK`

```json
{
  "debates": [
    {
      "id": "550e8400-...",
      "topic": "Should AI be regulated?",
      "status": "running",
      "current_turn": 12,
      "max_turns": 100,
      "agent_a_name": "Pro Regulation",
      "agent_b_name": "Anti Regulation",
      "created_at": "2026-04-05T12:00:00Z",
      "updated_at": "2026-04-05T12:05:00Z"
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0
}
```

---

#### `GET /api/v1/debates/{id}`

Get full debate details including all turns. Serves two purposes:

1. **Authenticated owner:** Returns full debate with all turns (used to load history before resuming or viewing)
2. **Unauthenticated user:** If the debate status is `"completed"`, returns the debate and all turns as a public shareable view. If not completed, returns `404`.

**Response:** `200 OK`

```json
{
  "id": "550e8400-...",
  "topic": "Should AI be regulated?",
  "agent_a_config": {
    "name": "Pro Regulation",
    "personality": "A cautious policy expert...",
    "provider": "openai",
    "model": "gpt-4.1"
  },
  "agent_b_config": {
    "name": "Anti Regulation",
    "personality": "A libertarian technologist...",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "status": "completed",
  "current_turn": 100,
  "max_turns": 100,
  "turns": [
    {
      "turn_number": 0,
      "agent_name": "Pro Regulation",
      "agent_side": "a",
      "content": "I argue that governments must regulate AI because...",
      "model_used": "gpt-4.1",
      "created_at": "2026-04-05T12:00:05Z"
    },
    {
      "turn_number": 1,
      "agent_name": "Anti Regulation",
      "agent_side": "b",
      "content": "While I understand the concern, regulation stifles...",
      "model_used": "claude-sonnet-4-20250514",
      "created_at": "2026-04-05T12:00:35Z"
    }
  ],
  "created_at": "2026-04-05T12:00:00Z"
}
```

---

#### `POST /api/v1/debates/{id}/next-turn`

Generate the next turn of a debate. Auth required. Returns an SSE stream.

**Request headers:**

```
Authorization: Bearer <jwt>
X-OpenAI-Key: sk-abc123...       (required if this turn's agent uses OpenAI)
X-Anthropic-Key: sk-ant-def456... (required if this turn's agent uses Anthropic)
```

No request body. The server determines which agent speaks next from `current_turn % 2`.

**Response:** SSE stream (`Content-Type: text/event-stream`)

SSE events emitted (see Section 5.8 for full protocol):

```
event: turn_start
data: {"turn": 0, "agent_name": "Pro Regulation", "agent_side": "a", "model": "gpt-4.1"}

event: token
data: {"text": "I "}

event: token
data: {"text": "argue "}

event: token
data: {"text": "that..."}

event: turn_complete
data: {"turn": 0, "agent_name": "Pro Regulation", "content": "I argue that...", "debate_status": "running", "current_turn": 1}

```

**Response status codes:**

- `200`: Turn generated successfully (SSE stream)
- `204 No Content`: Debate is already completed (current_turn >= max_turns)
- `400 Bad Request`: Missing required API key header for this turn's agent provider
- `401 Unauthorized`: Invalid/missing JWT or invalid model provider API key (from provider error)
- `404 Not Found`: Debate not found or not owned by user
- `409 Conflict`: Another request already claimed this turn (optimistic concurrency violation)
- `429 Too Many Requests`: Model provider rate limit hit (pass through provider's retry-after)

**Logic (critical — this is the core of the backend):**

```python
async def generate_next_turn(debate_id: str, user_id: str, api_keys: dict):
    async with db.begin() as session:
        # Step 1: Lock the debate row and read current state
        debate = await session.execute(
            select(Debate)
            .where(Debate.id == debate_id, Debate.user_id == user_id)
            .with_for_update()  # Row-level lock
        )
        debate = debate.scalar_one_or_none()
        if not debate:
            raise HTTPException(404)

        # Step 2: Check if debate is complete
        if debate.current_turn >= debate.max_turns:
            debate.status = "completed"
            await session.commit()
            return Response(status_code=204)

        # Step 3: Determine which agent speaks
        turn_number = debate.current_turn
        if turn_number % 2 == 0:
            agent_config = debate.agent_a_config
            agent_side = "a"
            other_config = debate.agent_b_config
        else:
            agent_config = debate.agent_b_config
            agent_side = "b"
            other_config = debate.agent_a_config

        # Step 4: Validate API key is provided for this agent's provider
        provider = agent_config["provider"]
        api_key = api_keys.get(provider)
        if not api_key:
            raise HTTPException(400, f"Missing API key for provider: {provider}")

        # Step 5: Claim this turn (optimistic concurrency)
        result = await session.execute(
            update(Debate)
            .where(Debate.id == debate_id, Debate.current_turn == turn_number)
            .values(current_turn=turn_number + 1, status="running", updated_at=func.now())
        )
        if result.rowcount == 0:
            raise HTTPException(409, "Turn already claimed by another request")

        await session.commit()

    # Step 6: Load conversation history from DB
    turns = await load_turns(debate_id)

    # Step 7: Build conversation input for the current agent
    conversation = build_agent_input(
        topic=debate.topic,
        turns=turns,
        current_agent_side=agent_side,
        current_agent_name=agent_config["name"],
        other_agent_name=other_config["name"],
    )

    # Step 8: Create the Agent using the SDK
    agent = create_agent(agent_config, api_key)

    # Step 9: Stream the response via SSE
    return EventSourceResponse(
        stream_turn(debate_id, turn_number, agent, agent_config, conversation)
    )
```

---

### 5.4 Authentication Middleware

The backend validates JWTs issued by NextAuth.js. Both the Next.js app and the FastAPI backend share a `NEXTAUTH_SECRET` environment variable.

```python
# middleware/auth.py
from jose import jwt, JWTError

async def get_current_user(authorization: str = Header(...)) -> str:
    """Extract and validate JWT from Authorization header. Returns user_id."""
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, settings.NEXTAUTH_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(401, "Invalid token")
```

Endpoints that need auth use `user_id: str = Depends(get_current_user)` as a parameter.

The `GET /api/v1/debates/{id}` endpoint has special handling: it first tries auth, and if no auth is provided, it checks if the debate is completed (public shareable view).

### 5.5 Debate Orchestration Engine

The orchestration engine is in `services/debate_orchestrator.py`. Its job is to:

1. Create an Agent from config + user API key
2. Build the conversation input from stored turns
3. Run `Runner.run_streamed()` for one turn
4. Stream tokens to the SSE response
5. After streaming completes, extract the full response text and save to DB

```python
# services/debate_orchestrator.py

from agents import Agent, Runner
from agents.items import MessageOutputItem, ItemHelpers

async def stream_turn(debate_id, turn_number, agent, agent_config, conversation):
    """Async generator that yields SSE events for one turn."""

    # Emit turn_start event
    yield {
        "event": "turn_start",
        "data": json.dumps({
            "turn": turn_number,
            "agent_name": agent_config["name"],
            "agent_side": "a" if turn_number % 2 == 0 else "b",
            "model": agent_config["model"],
        })
    }

    accumulated_text = ""

    try:
        result = Runner.run_streamed(agent, input=conversation)

        async for event in result.stream_events():
            if event.type == "raw_response_event":
                # Extract text delta from the raw model event.
                # The SDK normalizes events to Responses API format.
                # Look for ResponseTextDeltaEvent.
                from openai.types.responses import ResponseTextDeltaEvent
                if isinstance(event.data, ResponseTextDeltaEvent):
                    delta = event.data.delta
                    accumulated_text += delta
                    yield {
                        "event": "token",
                        "data": json.dumps({"text": delta})
                    }

        # Fallback: if accumulated_text is empty (event type mismatch),
        # extract from result.new_items
        if not accumulated_text:
            for item in result.new_items:
                if isinstance(item, MessageOutputItem):
                    accumulated_text = ItemHelpers.text_message_output(item)
                    break

        # Save the completed turn to DB
        await save_turn(
            debate_id=debate_id,
            turn_number=turn_number,
            agent_name=agent_config["name"],
            agent_side="a" if turn_number % 2 == 0 else "b",
            content=accumulated_text,
            model_used=agent_config["model"],
        )

        # Check if debate is now complete
        debate = await get_debate(debate_id)
        if debate.current_turn >= debate.max_turns:
            await update_debate_status(debate_id, "completed")
            debate_status = "completed"
        else:
            debate_status = "running"

        # Emit turn_complete event
        yield {
            "event": "turn_complete",
            "data": json.dumps({
                "turn": turn_number,
                "agent_name": agent_config["name"],
                "content": accumulated_text,
                "debate_status": debate_status,
                "current_turn": debate.current_turn,
            })
        }

    except Exception as e:
        error_info = classify_error(e)
        # Mark debate as paused on failure
        await update_debate_status(debate_id, "paused")
        yield {
            "event": "error",
            "data": json.dumps(error_info)
        }
```

### 5.6 Agent Creation with OpenAI Agents SDK

The agent factory creates `Agent` instances dynamically from debate config and user API keys.

```python
# services/agent_factory.py

from openai import AsyncOpenAI
from agents import Agent, OpenAIResponsesModel

def create_agent(agent_config: dict, api_key: str) -> Agent:
    """Create an Agent instance from config and the user's API key."""

    provider = agent_config["provider"]
    model_name = agent_config["model"]
    personality = agent_config["personality"]
    name = agent_config["name"]

    if provider == "openai":
        client = AsyncOpenAI(api_key=api_key)
        model = OpenAIResponsesModel(model=model_name, openai_client=client)

    elif provider == "anthropic":
        from agents.extensions.models.litellm_provider import LitellmModel
        # LiteLLM model string format: "anthropic/<model_name>"
        litellm_model_name = f"anthropic/{model_name}"
        model = LitellmModel(model=litellm_model_name, api_key=api_key)

    else:
        raise ValueError(f"Unsupported provider: {provider}")

    instructions = build_system_prompt(name, personality, agent_config)

    return Agent(
        name=name,
        model=model,
        instructions=instructions,
    )
```

**Important note on LiteLLM integration:** The `LitellmModel` class is in `agents.extensions.models.litellm_provider`. It wraps LiteLLM's `acompletion()` call. If `LitellmModel` does not natively accept an `api_key` parameter, a thin wrapper may be needed:

```python
# Fallback if LitellmModel doesn't accept api_key directly:
import os
os.environ["ANTHROPIC_API_KEY"] = api_key  # Set per-request (safe in async single-thread)
model = LitellmModel(model=litellm_model_name)
```

This environment variable approach is safe in async Python because the event loop is single-threaded — no concurrent turn generation for the same process would overwrite it before the call completes. However, this should be tested during implementation, and a thread-safe alternative (custom `LitellmModel` subclass) should be used if needed.

### 5.7 Conversation Reconstruction

**This is a critical detail.** When building the input for `Runner.run_streamed()`, the conversation must be reconstructed so that:

- The **current agent's** previous responses appear as `"assistant"` role (the model recognizes them as its own)
- The **opponent's** responses appear as `"user"` role with a name prefix (so the model knows they're from someone else)
- The debate topic is embedded in the **system prompt** (Agent.instructions), not in the conversation

You CANNOT use `result.to_input_list()` to chain across agents. If you pass Agent A's response (marked as "assistant") to Agent B, Agent B would think it said those words. Each agent must see a conversation reconstructed from its own perspective.

```python
# services/debate_orchestrator.py

def build_system_prompt(agent_name: str, personality: str, agent_config: dict) -> str:
    """Build the system prompt for a debater agent."""
    return f"""You are {agent_name}, a debater with the following personality:
{personality}

You are participating in a structured debate. Your opponent's arguments will be presented
as messages labeled with their name. Respond with your next argument.

Rules:
- Be persuasive and substantive
- Directly address your opponent's most recent points
- Do not repeat previous arguments verbatim
- Support claims with reasoning and evidence
- Keep responses focused and under 500 words"""


def build_agent_input(
    topic: str,
    turns: list,       # List of Turn rows from DB, ordered by turn_number
    current_agent_side: str,  # "a" or "b"
    current_agent_name: str,
    other_agent_name: str,
) -> list[dict]:
    """
    Build the conversation input for Runner.run_streamed().

    Returns a list of message dicts with "role" and "content" keys.
    """
    messages = []

    if not turns:
        # First turn of the debate (Agent A's opening argument)
        messages.append({
            "role": "user",
            "content": f"The debate topic is: \"{topic}\"\n\nPlease present your opening argument.",
        })
    else:
        # Subsequent turns: reconstruct from stored turns
        # First message establishes the topic context
        messages.append({
            "role": "user",
            "content": f"The debate topic is: \"{topic}\"\n\n"
                       f"The debate has begun. Here is the conversation so far.",
        })

        for turn in turns:
            if turn.agent_side == current_agent_side:
                # This agent's own previous response
                messages.append({
                    "role": "assistant",
                    "content": turn.content,
                })
            else:
                # Opponent's response — presented as a user message
                messages.append({
                    "role": "user",
                    "content": f"[{other_agent_name}]: {turn.content}",
                })

        # Final prompt to elicit the next response
        messages.append({
            "role": "user",
            "content": "Please respond with your next argument.",
        })

    return messages
```

**Example for Turn 4 (Agent A's 3rd response):**

```
System (instructions): "You are Pro Regulation, a debater with the following personality..."

Input messages:
  user: "The debate topic is: 'Should AI be regulated?' ..."
  assistant: "In my opening argument, I contend..."      ← Turn 0 (Agent A, own)
  user: "[Anti Regulation]: I fundamentally disagree..."   ← Turn 1 (Agent B, opponent)
  assistant: "While my opponent makes a fair point..."     ← Turn 2 (Agent A, own)
  user: "[Anti Regulation]: The evidence clearly shows..." ← Turn 3 (Agent B, opponent)
  user: "Please respond with your next argument."
```

### 5.8 SSE Streaming Protocol

The server emits the following SSE event types. The frontend must handle each.

`**turn_start**` — Emitted once at the beginning of the turn before any tokens.

```
event: turn_start
data: {"turn": 0, "agent_name": "Pro Regulation", "agent_side": "a", "model": "gpt-4.1"}
```

`**token**` — Emitted for each text token/delta from the model. High frequency.

```
event: token
data: {"text": "I "}
```

`**turn_complete**` — Emitted once when the turn is fully generated and saved to DB.

```
event: turn_complete
data: {"turn": 0, "agent_name": "Pro Regulation", "content": "I argue that governments must...", "debate_status": "running", "current_turn": 1}
```

- `content`: the full response text (so the client has a canonical version)
- `debate_status`: "running" if more turns remain, "completed" if max_turns reached
- `current_turn`: the next turn number (for client-side validation)

`**error**` — Emitted if an error occurs during generation.

```
event: error
data: {"code": "invalid_api_key", "provider": "openai", "message": "Your OpenAI API key is invalid or expired. Please update it in Settings.", "recoverable": true}
```

Error codes:

- `invalid_api_key`: Provider rejected the API key (401 from provider). `recoverable: true` (user fixes key and retries).
- `rate_limited`: Provider rate limit hit (429). `recoverable: true` (retry after delay).
- `model_not_found`: Invalid model name. `recoverable: false` (debate config is wrong).
- `provider_error`: Generic provider error (500 from provider). `recoverable: true` (retry).
- `internal_error`: Server-side error. `recoverable: false`.

### 5.9 Error Handling

```python
# services/debate_orchestrator.py

def classify_error(e: Exception) -> dict:
    """Classify an exception into a structured error response."""
    from openai import AuthenticationError, RateLimitError, NotFoundError, APIError

    if isinstance(e, AuthenticationError):
        return {
            "code": "invalid_api_key",
            "provider": extract_provider(e),
            "message": "Your API key is invalid or expired. Please update it in Settings.",
            "recoverable": True,
        }
    elif isinstance(e, RateLimitError):
        return {
            "code": "rate_limited",
            "provider": extract_provider(e),
            "message": "Rate limit exceeded. Please wait a moment and try again.",
            "recoverable": True,
        }
    elif isinstance(e, NotFoundError):
        return {
            "code": "model_not_found",
            "message": f"Model not found. Please check the model name in your debate configuration.",
            "recoverable": False,
        }
    else:
        return {
            "code": "internal_error",
            "message": "An unexpected error occurred. Please try again.",
            "recoverable": True,
        }
```

On error:

1. The SSE stream emits an `error` event
2. The debate status is set to `"paused"` in the DB
3. The `current_turn` is **not decremented** — the turn was already claimed. The failed turn has no entry in the `turns` table (it was never saved because it didn't complete). So the next retry will attempt the same turn number, which will succeed because the `turns` table has no entry for it. The optimistic concurrency on `debates.current_turn` was already incremented, so the retry doesn't conflict.

**Wait — this means the retry needs special handling.** When a turn fails:

- `debates.current_turn` was already incremented (Step 5 in the endpoint logic)
- But no turn was saved to `turns` table
- On retry, the client calls `POST /next-turn` again
- The server reads `current_turn` (already incremented), so it tries to generate the NEXT turn, skipping the failed one

**Fix:** The turn claim (Step 5) should only increment `current_turn` AFTER the turn is saved, not before. Revised approach:

1. Lock the debate row, read `current_turn`
2. Check if a turn with this `turn_number` already exists in `turns` table
3. If yes: return `409 Conflict` (another request completed this turn)
4. If no: proceed to generate
5. After successful generation, save turn + increment `current_turn` in one transaction

This way, if generation fails, `current_turn` is unchanged and the retry generates the same turn. The race condition protection comes from the `UNIQUE(debate_id, turn_number)` constraint — if two requests try to save the same turn, one will fail.

**Revised endpoint logic for next-turn:**

```python
async def generate_next_turn(debate_id, user_id, api_keys):
    # Step 1: Read debate state (no lock yet — just read)
    debate = await get_debate(debate_id, user_id)
    if not debate:
        raise HTTPException(404)

    turn_number = debate.current_turn
    if turn_number >= debate.max_turns:
        return Response(status_code=204)

    # Step 2: Check if this turn already exists (completed by another request)
    existing_turn = await get_turn(debate_id, turn_number)
    if existing_turn:
        raise HTTPException(409, "Turn already generated")

    # Step 3: Determine agent, validate API key, build conversation
    # ... (same as before)

    # Step 4: Stream the response
    # After streaming completes successfully, in ONE transaction:
    #   - INSERT into turns
    #   - UPDATE debates SET current_turn = current_turn + 1
    # The UNIQUE constraint on (debate_id, turn_number) prevents duplicates
    return EventSourceResponse(stream_turn(...))
```

---

## 6. Frontend (Next.js)

### 6.1 Dependencies

```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18.3",
    "react-dom": "^18.3",
    "next-auth": "^5.0",
    "zustand": "^4.5",
    "react-markdown": "^9.0",
    "lucide-react": "^0.380",
    "tailwind-merge": "^2.3",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1"
  },
  "devDependencies": {
    "tailwindcss": "^3.4",
    "postcss": "^8.4",
    "autoprefixer": "^10.4",
    "typescript": "^5.4",
    "@types/react": "^18.3",
    "@types/node": "^20"
  }
}
```

shadcn/ui components are installed via `npx shadcn-ui@latest init` and then individual components via `npx shadcn-ui@latest add button card dialog input label select textarea avatar scroll-area separator sheet badge dropdown-menu tooltip`.

### 6.2 Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing page (public, SEO)
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx        # Login page
│   ├── (app)/
│   │   ├── layout.tsx          # App layout with sidebar
│   │   ├── page.tsx            # Redirects to /app/debates
│   │   ├── debates/
│   │   │   └── page.tsx        # Debate list (default view)
│   │   ├── debate/
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Single debate view (live or history)
│   │   ├── new/
│   │   │   └── page.tsx        # Create new debate form
│   │   └── settings/
│   │       └── page.tsx        # API key management
│   ├── shared/
│   │   └── [id]/
│   │       └── page.tsx        # Public shared debate view (no auth)
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts    # NextAuth API routes
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── layout/
│   │   ├── Sidebar.tsx         # Debate list sidebar (Claude.ai style)
│   │   ├── Header.tsx          # Top header with user menu
│   │   └── AppShell.tsx        # Main app shell (sidebar + content)
│   ├── debate/
│   │   ├── DebateView.tsx      # Main debate display (messages)
│   │   ├── DebateMessage.tsx   # Single agent message bubble
│   │   ├── DebateStatus.tsx    # Status badge (running/paused/completed)
│   │   ├── CreateDebateForm.tsx  # New debate form
│   │   ├── AgentConfig.tsx     # Agent configuration sub-form
│   │   └── StreamingText.tsx   # Animated streaming text display
│   └── settings/
│       └── ApiKeyForm.tsx      # API key entry form
├── stores/
│   ├── debateManager.ts        # Zustand store for debate loops
│   └── apiKeys.ts              # Zustand store for cached API keys
├── lib/
│   ├── api.ts                  # API client (fetch wrapper)
│   ├── sse.ts                  # SSE stream reader utility
│   ├── auth.ts                 # NextAuth configuration
│   └── utils.ts                # Shared utilities
├── types/
│   └── index.ts                # TypeScript type definitions
├── tailwind.config.ts
├── next.config.ts
├── Dockerfile
└── .env.example
```

### 6.3 Pages and Routing


| Route              | Auth | Description                                                                                               |
| ------------------ | ---- | --------------------------------------------------------------------------------------------------------- |
| `/`                | No   | Landing page. SEO-optimized. Hero section, feature highlights, "Get Started" CTA.                         |
| `/login`           | No   | Login page with "Sign in with Google" button.                                                             |
| `/app`             | Yes  | Main app shell. Redirects to `/app/debates`.                                                              |
| `/app/debates`     | Yes  | Default view. Shows the most recent debate or an empty state.                                             |
| `/app/debate/[id]` | Yes  | View a specific debate. If running/paused, shows live view with resume. If completed, shows full history. |
| `/app/new`         | Yes  | Create new debate form.                                                                                   |
| `/app/settings`    | Yes  | Manage API keys.                                                                                          |
| `/shared/[id]`     | No   | Public view of a completed debate. Read-only.                                                             |


### 6.4 Component Hierarchy

The main app layout (Claude.ai-inspired):

```
┌──────────────────────────────────────────────────────┐
│  Header (logo, user avatar, settings)                │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Sidebar  │  Main Content Area                        │
│          │                                           │
│ [+ New]  │  ┌─────────────────────────────────────┐  │
│          │  │  Debate Topic Header                │  │
│ Debate 1 │  │  Status: Running (Turn 12/100)      │  │
│ Debate 2 │  ├─────────────────────────────────────┤  │
│ Debate 3 │  │                                     │  │
│ Debate 4 │  │  Agent A: "I argue that..."         │  │
│ (active) │  │                                     │  │
│ Debate 5 │  │  Agent B: "However, I disagree..."  │  │
│          │  │                                     │  │
│          │  │  Agent A: "Consider the evidence..." │  │
│          │  │                                     │  │
│          │  │  Agent B: █ (streaming cursor)       │  │
│          │  │                                     │  │
│          │  └─────────────────────────────────────┘  │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

**Sidebar behavior:**

- Shows all user debates, most recent first
- Each entry shows: topic (truncated), status badge (running/paused/completed), agent names
- Active/running debates show a subtle animation (pulsing dot)
- "+ New Debate" button at the top
- Clicking a debate loads it in the main content area (client-side navigation, no page reload)
- Sidebar is collapsible on mobile

**Main content area:**

- Debate header: topic, status, turn counter, agent info (names, models)
- Message list: alternating messages from Agent A and Agent B, visually distinguished (different background colors, avatars)
- Streaming indicator: blinking cursor while tokens are arriving
- Resume button: shown when debate is paused
- Auto-scroll: scrolls to bottom as new tokens arrive, with manual scroll override

### 6.5 DebateManager (Client-Side Loop)

The `DebateManager` is a Zustand store that manages concurrent debate loops. It persists in memory for the lifetime of the SPA.

```typescript
// stores/debateManager.ts

interface DebateMessage {
  turnNumber: number;
  agentName: string;
  agentSide: 'a' | 'b';
  content: string;
  isStreaming: boolean;
}

interface ActiveDebate {
  debateId: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  messages: DebateMessage[];
  currentTurn: number;
  maxTurns: number;
  error?: { code: string; message: string; recoverable: boolean };
  abortController: AbortController;
}

interface DebateManagerState {
  activeDebates: Record<string, ActiveDebate>;
  startDebate: (debateId: string) => void;
  resumeDebate: (debateId: string, existingTurns: Turn[]) => void;
  pauseDebate: (debateId: string) => void;
  getDebate: (debateId: string) => ActiveDebate | undefined;
}
```

**The loop implementation:**

```typescript
// Inside the Zustand store action

async function runDebateLoop(debateId: string, apiKeys: ApiKeys, signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/debates/${debateId}/next-turn`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getJWT()}`,
            'X-OpenAI-Key': apiKeys.openai || '',
            'X-Anthropic-Key': apiKeys.anthropic || '',
          },
          signal,
        }
      );

      // Debate completed
      if (response.status === 204) {
        updateDebateStatus(debateId, 'completed');
        break;
      }

      // Race condition — another tab claimed this turn, retry immediately
      if (response.status === 409) {
        continue;
      }

      // Client error (missing key, not found, etc.)
      if (response.status >= 400) {
        const error = await response.json();
        setDebateError(debateId, error);
        break;
      }

      // Read SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSEEvents(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          switch (event.event) {
            case 'turn_start':
              addStreamingMessage(debateId, event.data);
              break;
            case 'token':
              appendToken(debateId, event.data.text);
              break;
            case 'turn_complete':
              finalizeMessage(debateId, event.data);
              if (event.data.debate_status === 'completed') {
                updateDebateStatus(debateId, 'completed');
              }
              break;
            case 'error':
              setDebateError(debateId, event.data);
              break;
          }
        }
      }

      // If debate completed during this turn, break
      const debate = getDebate(debateId);
      if (debate?.status === 'completed' || debate?.status === 'error') {
        break;
      }

    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // User manually paused — not an error
        break;
      }
      // Network error or unexpected failure
      setDebateError(debateId, {
        code: 'network_error',
        message: 'Connection lost. The debate has been paused.',
        recoverable: true,
      });
      break;
    }
  }
}
```

**SSE parser utility:**

```typescript
// lib/sse.ts

interface ParsedSSEEvent {
  event: string;
  data: any;
}

function parseSSEEvents(buffer: string): { parsed: ParsedSSEEvent[]; remaining: string } {
  const events: ParsedSSEEvent[] = [];
  const lines = buffer.split('\n');
  let currentEvent = '';
  let currentData = '';
  let remaining = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7);
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6);
    } else if (line === '') {
      // Empty line = end of event
      if (currentEvent && currentData) {
        events.push({ event: currentEvent, data: JSON.parse(currentData) });
      }
      currentEvent = '';
      currentData = '';
    } else {
      // Incomplete event at the end of buffer
      remaining = lines.slice(i).join('\n');
      break;
    }
  }

  return { parsed: events, remaining };
}
```

### 6.6 UI Design

**Design principles:** Clean, minimal, Claude.ai-inspired. Light mode with a warm neutral palette. Emphasis on readability.

**Color scheme (Tailwind):**

- Background: `slate-50` (light gray)
- Sidebar: `white` with `slate-200` border
- Agent A messages: `blue-50` background, `blue-700` accent
- Agent B messages: `emerald-50` background, `emerald-700` accent
- Streaming cursor: pulsing `slate-400` block
- Status badges: `green-500` (running), `yellow-500` (paused), `slate-400` (completed)

**DebateMessage component:**

```
┌──────────────────────────────────────────┐
│  🤖 Pro Regulation (GPT-4.1)    Turn 3  │
├──────────────────────────────────────────┤
│                                          │
│  I argue that governments must establish │
│  regulatory frameworks for AI because... │
│                                          │
│  1. Safety concerns require oversight    │
│  2. Market failures in self-regulation   │
│  3. Democratic accountability demands... │
│                                          │
└──────────────────────────────────────────┘
```

- Agent avatar (colored circle with initials or robot icon)
- Agent name + model name (subtle)
- Turn number (subtle, right-aligned)
- Message content rendered as markdown (supports bold, italic, lists, code)
- Different background colors for Agent A vs Agent B

**CreateDebateForm:**

```
┌──────────────────────────────────────────────────────┐
│  Create New Debate                                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Debate Topic                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │ Should AI be regulated by governments?       │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────┐ ┌─────────────────────┐    │
│  │ Agent A              │ │ Agent B              │    │
│  │                      │ │                      │    │
│  │ Name: Pro Regulation │ │ Name: Anti Reg.      │    │
│  │                      │ │                      │    │
│  │ Provider: [OpenAI v] │ │ Provider: [Anthro v] │    │
│  │ Model: [GPT-4.1   v] │ │ Model: [Sonnet 4  v] │    │
│  │                      │ │                      │    │
│  │ Personality:         │ │ Personality:         │    │
│  │ ┌──────────────────┐ │ │ ┌──────────────────┐ │    │
│  │ │A cautious policy │ │ │ │A libertarian     │ │    │
│  │ │expert who...     │ │ │ │technologist...   │ │    │
│  │ └──────────────────┘ │ │ └──────────────────┘ │    │
│  └─────────────────────┘ └─────────────────────┘    │
│                                                      │
│  [Start Debate]                                      │
└──────────────────────────────────────────────────────┘
```

**Model selector options:**

OpenAI (requires OpenAI API key):

- `gpt-4o` — "GPT-4o"
- `gpt-4o-mini` — "GPT-4o Mini"
- `gpt-4.1` — "GPT-4.1"
- `gpt-4.1-mini` — "GPT-4.1 Mini"
- `gpt-4.1-nano` — "GPT-4.1 Nano"

Anthropic (requires Anthropic API key):

- `claude-sonnet-4-20250514` — "Claude Sonnet 4"
- `claude-opus-4-20250514` — "Claude Opus 4"
- `claude-haiku-3.5` — "Claude 3.5 Haiku"

The model list is hardcoded in the frontend. The model string value is sent as-is to the backend. For Anthropic models, the backend prepends `anthropic/` for LiteLLM.

### 6.7 Auth Flow

NextAuth.js (Auth.js v5) with Google OAuth.

```typescript
// lib/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        // First sign in — create/get user in our DB
        const user = await createOrGetUser(profile.email, profile.name, profile.picture);
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      return session;
    },
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,  // Shared with FastAPI backend
});
```

The frontend obtains a JWT from NextAuth and includes it as `Authorization: Bearer <jwt>` in all requests to the FastAPI backend. The backend validates the JWT using the shared `NEXTAUTH_SECRET`.

On first Google sign-in, the frontend's NextAuth callback calls the backend `POST /api/v1/users` (or handles user creation internally) to ensure the user exists in the `users` table.

---

## 7. User Flows

### 7.1 First-Time User

1. User visits `/` (landing page)
2. Clicks "Get Started" → redirected to `/login`
3. Clicks "Sign in with Google" → Google OAuth flow
4. On success, redirected to `/app`
5. App shows empty state: "Welcome! Before creating a debate, add your API keys."
6. User navigates to `/app/settings`
7. User enters their OpenAI API key → `POST /api/v1/keys` → saved to DB
8. User enters their Anthropic API key → `POST /api/v1/keys` → saved to DB
9. Frontend calls `GET /api/v1/keys/decrypt` → caches keys in memory
10. User navigates to `/app/new`
11. Fills out the create debate form (topic, agent configs)
12. Clicks "Start Debate" → `POST /api/v1/debates` → debate created
13. Redirected to `/app/debate/{id}`
14. DebateManager starts the debate loop automatically
15. User watches tokens stream in real-time

### 7.2 Starting a Debate

1. User clicks "+ New Debate" in sidebar
2. Navigates to `/app/new`
3. Fills in topic, agent A config (name, provider, model, personality), agent B config
4. Frontend validates: required fields filled, API keys exist for selected providers
5. Clicks "Start Debate" → `POST /api/v1/debates`
6. Backend validates and creates debate row with `status: "created"`, `current_turn: 0`
7. Frontend receives debate ID, navigates to `/app/debate/{id}`
8. DebateManager calls `startDebate(debateId)`:
  a. Creates an `AbortController`
   b. Enters the loop: `POST /debates/{id}/next-turn` with API keys in headers
   c. First call: backend generates Agent A's opening argument, streams via SSE
   d. Tokens appear in the UI in real-time
   e. Turn completes → loop calls again → Agent B responds → and so on

### 7.3 Watching a Live Debate

1. User is on `/app/debate/{id}` while the DebateManager loop is running
2. Messages appear one by one, each streaming token by token
3. Between turns: brief "thinking" indicator while the next API call is in flight
4. Turn counter updates after each turn
5. User can scroll up to read previous messages (auto-scroll pauses)
6. User can scroll back to bottom to resume auto-scroll

### 7.4 Switching Between Debates

1. User has 3 debates running (3 active loops in DebateManager)
2. User clicks Debate 2 in the sidebar
3. Main content area switches to Debate 2's messages (from DebateManager's in-memory state)
4. All 3 loops continue running in the background
5. User clicks Debate 1 → sees Debate 1's current state (messages accumulated while they were viewing Debate 2)

### 7.5 Client-Side Disconnect (Page Refresh)

1. User refreshes the page during a running debate
2. All DebateManager loops are destroyed (JS context lost)
3. On page reload:
  a. NextAuth restores the session (JWT in cookie)
   b. Frontend calls `GET /api/v1/keys/decrypt` to re-cache API keys
   c. Frontend calls `GET /api/v1/debates` to load debate list
4. User sees their debates in the sidebar. Running debates show as "running" in the DB.
5. The backend has no active loop for these debates — they're effectively paused.
6. On server startup or on first request, the backend scans for `status = "running"` debates and sets them to `"paused"`.
  - Alternatively: The `GET /api/v1/debates` response includes the status from DB. When the frontend sees `status: "running"` but has no active loop for this debate, it shows a "Resume" button.
7. User clicks on a paused debate → `GET /api/v1/debates/{id}` loads full history
8. User clicks "Resume" → DebateManager starts a new loop → `POST /next-turn` picks up from `current_turn`

### 7.6 Server Crash Recovery

1. Server crashes mid-turn
2. The current turn was not saved to DB (save happens after completion)
3. `debates.current_turn` was NOT incremented (revised logic: increment happens with turn save)
4. When the server restarts (or a different server handles the next request):
  a. The debate is `status: "running"` in DB, but `current_turn` matches the last saved turn
   b. No active loop exists for this debate
5. On backend startup: a cleanup task sets all `status = "running"` to `status = "paused"`
6. User reconnects → loads history → clicks Resume → loop restarts from the correct turn

### 7.7 Debate Completion

1. The DebateManager loop calls `POST /next-turn`
2. Backend checks: `current_turn >= max_turns`
3. Backend returns `204 No Content`
4. DebateManager marks the debate as `completed` in local state
5. Sidebar updates the status badge
6. Main content area shows: "Debate completed! 100 turns."
7. A "Share" button appears

### 7.8 Sharing a Completed Debate

1. User views a completed debate
2. Clicks "Share" button
3. Frontend generates the URL: `https://aidebatearena.com/shared/{debate_id}`
4. URL is copied to clipboard
5. Anyone with the link can visit the URL
6. The shared page calls `GET /api/v1/debates/{id}` without auth
7. Backend checks: debate exists AND `status = "completed"` → returns full debate with all turns
8. The page renders a read-only view of the full debate

### 7.9 Error During Debate (Invalid API Key)

1. Mid-debate, the model provider rejects the API key (e.g., user revoked it)
2. `Runner.run_streamed()` throws an `AuthenticationError`
3. The SSE stream emits an `error` event: `{"code": "invalid_api_key", "provider": "openai", ...}`
4. Backend sets debate status to `"paused"`
5. Frontend DebateManager:
  a. Stops the loop
   b. Shows error message in the UI: "Your OpenAI API key is invalid. Please update it in Settings."
   c. Debate shows as "paused" with error state
6. User goes to Settings, updates their key
7. Frontend re-fetches keys (`GET /api/v1/keys/decrypt`)
8. User returns to the debate, clicks "Resume"
9. Loop restarts with the new key

### 7.10 Viewing Past Debates

1. User clicks on a completed debate in the sidebar
2. Frontend calls `GET /api/v1/debates/{id}` → returns full history with all turns
3. Main content area renders all messages (no streaming, instant render)
4. User can scroll through the full debate
5. Share button is available

---

## 8. Deployment (Railway)

### 8.1 Railway Services

Create 3 services on Railway, all in one project:

**Service 1: Frontend (Next.js)**

- **Source:** GitHub repo, `/frontend` directory
- **Build command:** `npm run build`
- **Start command:** `npm start`
- **Port:** 3000
- **Custom domain:** `aidebatearena.com`

**Service 2: Backend (FastAPI)**

- **Source:** GitHub repo, `/backend` directory
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **Port:** 8000
- **Custom domain:** `api.aidebatearena.com`
- **Health check:** `GET /api/v1/health`

**Service 3: PostgreSQL**

- **Type:** Railway managed Postgres
- **Auto-provisioned:** Railway provides `DATABASE_URL`

### 8.2 Environment Variables

**Frontend (.env):**

```
NEXTAUTH_URL=https://aidebatearena.com
NEXTAUTH_SECRET=<shared-secret-with-backend>
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
NEXT_PUBLIC_API_URL=https://api.aidebatearena.com
```

**Backend (.env):**

```
DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>:<port>/<db>
NEXTAUTH_SECRET=<shared-secret-with-frontend>
ENCRYPTION_KEY=<fernet-key-for-api-key-encryption>
CORS_ORIGINS=https://aidebatearena.com
```

**Generate secrets:**

```bash
# NEXTAUTH_SECRET (shared between frontend and backend)
openssl rand -base64 32

# ENCRYPTION_KEY (Fernet key for API key encryption)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 8.3 CORS Configuration

The FastAPI backend must allow CORS from the frontend domain:

```python
# app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGINS],  # https://aidebatearena.com
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
```

### 8.4 Database Table Creation

Tables are created automatically on server startup via `Base.metadata.create_all()` in the FastAPI lifespan handler. No migration tooling needed for the MVP. SQLAlchemy's `create_all()` is idempotent — it only creates tables that don't already exist, so it's safe to run on every startup.

### 8.5 Custom Domain Setup

1. Register domain (e.g., `aidebatearena.com`) with any registrar
2. In Railway dashboard, add custom domain to the frontend service: `aidebatearena.com`
3. Add custom domain to the backend service: `api.aidebatearena.com`
4. Railway provides DNS records (CNAME) to add at your registrar
5. Add the DNS records, wait for propagation
6. Railway auto-provisions SSL certificates

---

## 9. Local Development

### 9.1 Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for local Postgres)
- `uv` (Python package manager, optional but recommended)

### 9.2 Docker Compose (Postgres only)

```yaml
# docker-compose.yml (at repo root)
version: "3.8"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: debate
      POSTGRES_PASSWORD: debate_local
      POSTGRES_DB: debate_arena
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 9.3 Backend Setup

```bash
cd backend

# Create virtual environment and install dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy env template
cp .env.example .env
# Edit .env with local values:
#   DATABASE_URL=postgresql+asyncpg://debate:debate_local@localhost:5432/debate_arena
#   NEXTAUTH_SECRET=local-dev-secret
#   ENCRYPTION_KEY=<generate with Fernet.generate_key()>
#   CORS_ORIGINS=http://localhost:3000

# Start Postgres
docker compose up -d

# Tables are created automatically on server startup via create_all()

# Start the server with hot reload
uvicorn app.main:app --reload --port 8000
```

### 9.4 Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Initialize shadcn/ui
npx shadcn-ui@latest init

# Copy env template
cp .env.example .env.local
# Edit .env.local:
#   NEXTAUTH_URL=http://localhost:3000
#   NEXTAUTH_SECRET=local-dev-secret
#   GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
#   GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
#   NEXT_PUBLIC_API_URL=http://localhost:8000

# Start the dev server
npm run dev
```

### 9.5 Google OAuth Setup (for local dev)

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID
3. Set authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Client Secret to `.env.local`

---

## 10. Priority Tiers

### P0 (MVP — must have for launch)

- User authentication (Google OAuth via NextAuth)
- API key management (BYOK for OpenAI and Anthropic)
- Create debate with topic, agent configs (name, personality, provider, model)
- Client-side debate loop with SSE streaming
- Turn generation with OpenAI Agents SDK
- Conversation reconstruction with per-agent perspective
- Optimistic concurrency (prevent duplicate turns)
- Debate persistence in Postgres (debates + turns tables)
- Resume paused/crashed debates from DB state
- Multiple concurrent debates in the SPA
- View completed debate history
- Share completed debates via public URL
- Beautiful Claude.ai-inspired UI with shadcn/ui
- Railway deployment (frontend + backend + Postgres)
- Local development setup with Docker Compose

### P1 (Important — soon after launch)

- Error handling polish (clear messages for all error types)
- Mobile-responsive UI
- Debate search/filter in sidebar
- Proper loading states and skeletons
- Rate limit handling with retry logic in the client loop

### P1.5 (Nice to have)

- Non-intrusive ad placement (Google AdSense or Carbon Ads) — bottom banner or sidebar, dismissable
- Debate analytics (average turn length, total tokens, etc.)

### P2 (Future)

- Ollama/local model support (requires infrastructure for local model hosting)
- Stop/pause debate button (currently pausing is just closing the tab/navigating away)
- User subscription tiers (Stripe integration, `subscription_tier` column on users table)
- Public debate gallery/feed
- "Judge" mode — a third AI agent evaluates the debate and picks a winner
- Export debate as PDF/markdown

---

## 11. Repository Structure

The final repository structure (separate from the openai-agents-python SDK repo):

```
ai-debate-arena/
├── frontend/               # Next.js application
│   ├── app/
│   ├── components/
│   ├── stores/
│   ├── lib/
│   ├── types/
│   ├── public/
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── utils/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml      # Local Postgres
├── README.md
└── .gitignore
```

---

## 12. Key Implementation Notes

### OpenAI Agents SDK Usage

This application uses the `openai-agents` pip package (source: [openai-agents-python](https://github.com/openai/openai-agents-python)). Key classes and their usage:

- `**Agent**` (`from agents import Agent`): A dataclass representing an agent configuration. Created with `name`, `model` (string or Model instance), and `instructions` (string system prompt).
- `**Runner**` (`from agents import Runner`): The execution engine. Use `Runner.run_streamed(agent, input=conversation)` to get a streaming result.
- `**RunResultStreaming**`: Returned by `Runner.run_streamed()`. Call `result.stream_events()` to get an async iterator of stream events. After iteration completes, `result.new_items` contains the generated items.
- `**OpenAIResponsesModel**` (`from agents import OpenAIResponsesModel`): Wraps OpenAI's Responses API. Accepts a custom `openai_client` parameter for per-user API keys.
- `**OpenAIChatCompletionsModel**` (`from agents import OpenAIChatCompletionsModel`): Wraps OpenAI's Chat Completions API. Used for OpenAI-compatible providers.
- `**LitellmModel**` (`from agents.extensions.models.litellm_provider import LitellmModel`): Wraps LiteLLM for non-OpenAI providers. Model string format: `"anthropic/claude-sonnet-4-20250514"`.
- `**RawResponsesStreamEvent**`: Stream event containing raw model token deltas. Check for `ResponseTextDeltaEvent` instances in `event.data` to extract text.
- `**MessageOutputItem**` (`from agents.items import MessageOutputItem`): A completed message in `result.new_items`. Use `ItemHelpers.text_message_output(item)` to extract text.

### Conversation Format

The `Runner.run_streamed(agent, input=...)` accepts `input` as a `str` or `list[dict]`. For debates, we pass a list of message dicts:

```python
[
    {"role": "user", "content": "The debate topic is: \"...\""},
    {"role": "assistant", "content": "Own previous response"},
    {"role": "user", "content": "[Opponent Name]: Opponent's response"},
    {"role": "user", "content": "Please respond with your next argument."},
]
```

The `Agent.instructions` field serves as the system prompt and contains the agent's personality and debate rules.

### Streaming Event Extraction

```python
from openai.types.responses import ResponseTextDeltaEvent

async for event in result.stream_events():
    if event.type == "raw_response_event":
        if isinstance(event.data, ResponseTextDeltaEvent):
            text_delta = event.data.delta  # This is the text token string
```

This pattern works for both OpenAI models (Responses API) and LiteLLM models because the SDK normalizes streaming events to the Responses API format.