# AI Debate Arena

A full-stack web application that orchestrates real-time AI debates between configurable LLM-powered agents. Pit OpenAI models against Anthropic models (or any combination) on any topic, with live token streaming, web search capabilities, and shareable debate links.

Built with the **OpenAI Agents SDK** (`openai-agents`) on the backend to manage agent orchestration, tool use, and streaming -- and **Next.js 14** on the frontend for a responsive, real-time UI.

Link: https://gallant-blessing-production-f241.up.railway.app/

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| **Framework** | FastAPI (async Python) |
| **Agent Orchestration** | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) (`openai-agents`) |
| **Multi-Provider LLM** | LiteLLM (routes Anthropic models through the Agents SDK) |
| **Web Search Tool** | Tavily API via `@function_tool` decorator |
| **Database** | PostgreSQL 16 with SQLAlchemy 2.0 (async) + asyncpg |
| **Streaming** | Server-Sent Events (SSE) via `sse-starlette` |
| **Auth** | BetterAuth, auto-provisioned users |
| **Encryption** | Fernet symmetric encryption for stored API keys |
| **Runtime** | Python 3.14+, managed with `uv` |

### Frontend

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router, TypeScript) |
| **UI Components** | shadcn/ui (Radix primitives) + Tailwind CSS |
| **State Management** | Zustand |
| **Auth** | BetterAuth (Discord, Credentials) |
| **Real-Time** | SSE consumption with custom parser |
| **Markdown** | react-markdown for rendered agent responses |

---

## How the OpenAI Agents SDK Is Used

The backend uses `openai-agents` as the core orchestration layer for running debate agents. Here's how it works:

### Agent Creation (`agent_factory.py`)

Each debate agent is an `Agent` instance from the SDK:

```python
from agents import Agent, OpenAIResponsesModel, function_tool
from agents.extensions.models.litellm_provider import LitellmModel

# OpenAI models use OpenAIResponsesModel directly
model = OpenAIResponsesModel(model="gpt-4o", openai_client=client)

# Anthropic models route through LiteLLM's extension
model = LitellmModel(model="anthropic/claude-sonnet-4-20250514", api_key=key)

agent = Agent(name="Pro Science", model=model, instructions=system_prompt, tools=[web_search])
```

### Tool Integration

Web search is implemented as a `@function_tool` that the agent can invoke during generation:

```python
@function_tool
def web_search(query: str) -> str:
    """Search the web for current information relevant to the debate."""
    response = tavily_client.search(query, max_results=5, search_depth="advanced")
    # Returns formatted results with titles, URLs, and content
```

### Streamed Execution (`debate_orchestrator.py`)

Each debate turn runs through `Runner.run_streamed()`, which yields real-time token events:

```python
result = Runner.run_streamed(agent, input=conversation_history)

async for event in result.stream_events():
    if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
        yield token_event(event.data.delta)  # SSE to frontend
```

The conversation history is reconstructed per-agent: the agent's own previous turns appear as `"assistant"` messages, while the opponent's turns appear as `"user"` messages prefixed with the opponent's name.

---

## Web Flows

### Authentication Flow

Users can sign in via **Discord** or **username/password**:

1. User clicks a sign-in option on the login page (or creates an account with username/email/password)
2. BetterAuth handles the OAuth flow (or credentials validation) and manages the session
3. The session token is sent to the backend on every API call
4. The backend verifies the session and auto-creates a user record on first login

### Debate Creation Flow

1. User navigates to `/new` and fills in:
   - **Topic**: The subject of the debate
   - **Agent A & B configs**: Name, personality, provider (OpenAI/Anthropic), model, and optional web search toggle
   - **Max turns**: How many turns the debate should last (2-100)
2. Frontend validates that the user has API keys configured for the selected providers
3. `POST /api/v1/debates` creates the debate record in the database

### Debate Execution Flow

1. Frontend enters a turn loop, calling `POST /api/v1/debates/{id}/next-turn` for each turn
2. Backend determines which agent speaks (even turns = Agent A, odd = Agent B)
3. The OpenAI Agents SDK creates an agent, reconstructs conversation history, and calls `Runner.run_streamed()`
4. Tokens stream back as SSE events (`turn_start` -> `token` x N -> `turn_complete`)
5. Frontend renders tokens in real-time with a blinking cursor animation
6. After each turn completes, the loop fires the next turn request
7. On the final turn, the backend returns HTTP 204 and the debate is marked `completed`

### Pause / Resume / Share

- **Pause**: The frontend aborts the SSE connection via `AbortController`. The debate stays at its current turn.
- **Resume**: Restarts the turn loop from where it left off.
- **Share**: Completed debates get a public URL (`/shared/{id}`) that anyone can view without authentication.

### API Key Management (BYOK)

- Users configure their own API keys in `/settings`
- Keys are encrypted with Fernet before storage in PostgreSQL
- Keys are decrypted in-memory only when needed for agent execution
- The UI shows only the last 4 characters for identification

---

## Usage Guide

### 1. Sign In

Click "Get Started" on the landing page and sign in with Discord or create an account with a username and password.

### 2. Configure API Keys

Navigate to **Settings** (gear icon in the header) and add your API keys:

- **OpenAI API Key** -- Required if you want to use GPT models (gpt-4o, gpt-4o-mini, etc.)
- **Anthropic API Key** -- Required if you want to use Claude models (claude-sonnet, claude-haiku, etc.)
- **Tavily API Key** -- Optional, enables the web search tool for agents to look up real-time information

### 3. Create a Debate

Click **New Debate** and configure:

- **Topic**: Any debate topic (e.g., "Should AI be regulated?")
- **Agent A**: Give it a name (e.g., "Pro Regulation"), a personality description, choose a provider and model
- **Agent B**: Configure the opposing side similarly
- **Web Search**: Toggle on for either agent if you want them to cite real-time sources
- **Max Turns**: Set how long the debate runs (default is reasonable, max 100)

### 4. Watch the Debate

Once created, the debate starts automatically. You'll see:

- Each agent's arguments streamed in real-time with a typing indicator
- Turn numbers and model labels on each message
- Markdown-formatted responses with proper headings, lists, and emphasis

### 5. Controls

- **Pause**: Stop the debate mid-stream to read or take a break
- **Resume**: Continue from where you paused
- **Restart**: Create a new debate with the same configuration
- **Share**: Copy a public link to share completed debates with anyone

### 6. Sidebar

The sidebar shows all your debates with status indicators:
- Green pulse = running
- Yellow = paused
- Checkmark = completed
- Blue = created (not yet started)

---

## Local Development Setup

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.14+ and [**uv**](https://docs.astral.sh/uv/) (Python package manager)
- **Docker** and **Docker Compose** (for PostgreSQL)
- At least one LLM API key (OpenAI or Anthropic)
- **Optional**: Discord developer app credentials (for OAuth sign-in -- username/password works without these)

### 1. Clone the Repository

```bash
git clone https://github.com/anishd7/aidebate.git
cd aidebate
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts a PostgreSQL 16 instance on port 5432 with:
- User: `debate`
- Password: `debate_local`
- Database: `debate_arena`

### 3. Set Up the Backend

```bash
cd backend

# Create .env from example
cp .env.example .env
```

Edit `.env` and generate a Fernet encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Your `.env` should look like:

```env
DATABASE_URL=postgresql+asyncpg://debate:debate_local@localhost:5432/debate_arena
NEXTAUTH_SECRET=local-dev-secret-change-in-production
ENCRYPTION_KEY=<paste-your-generated-fernet-key>
CORS_ORIGINS=http://localhost:3000
```

Install dependencies and start the server:

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The backend will automatically create database tables on first startup. The API will be available at `http://localhost:8000`.

### 4. Set Up the Frontend

```bash
cd ../frontend

# Create .env.local from example
cp .env.example .env.local
```

Edit `.env.local` with your OAuth credentials:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-change-in-production
NEXT_PUBLIC_API_URL=http://localhost:8000

# Discord OAuth (https://discord.com/developers/applications)
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

```

> **Note:** Discord credentials are optional -- username/password auth works without them.

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### 5. Verify Everything Works

1. Open `http://localhost:3000` in your browser
2. Create an account (username/password) or sign in with Discord
3. Go to Settings and add at least one API key (OpenAI or Anthropic)
4. Create a new debate and watch the agents argue in real-time

---

## Project Structure

```
aidebate/
├── docker-compose.yml              # PostgreSQL service
├── frontend/                       # Next.js 14 application
│   ├── app/                        # App Router pages and layouts
│   │   ├── (app)/                  # Authenticated routes (new, debate, settings)
│   │   ├── (auth)/                 # Login page
│   │   ├── shared/[id]/           # Public shared debate viewer
│   │   └── api/auth/              # NextAuth API route
│   ├── components/                 # React components
│   │   ├── debate/                # Debate creation, viewing, streaming
│   │   ├── layout/                # App shell, header, sidebar
│   │   ├── settings/              # API key management
│   │   └── ui/                    # shadcn/ui primitives
│   ├── lib/                       # API client, auth config, SSE parser
│   ├── stores/                    # Zustand stores (API keys, debate manager)
│   └── types/                     # TypeScript interfaces
├── backend/                       # FastAPI application
│   └── app/
│       ├── main.py                # App entrypoint, CORS, router registration
│       ├── config.py              # Pydantic settings
│       ├── database.py            # SQLAlchemy async engine and session
│       ├── models/                # ORM models (User, Debate, Turn, UserApiKey)
│       ├── routers/               # API endpoints (debates, turns, keys, health)
│       ├── schemas/               # Pydantic request/response models
│       ├── services/              # Core logic
│       │   ├── agent_factory.py   # Agent creation with OpenAI Agents SDK
│       │   ├── debate_orchestrator.py  # Turn streaming and persistence
│       │   └── encryption.py      # Fernet encryption for API keys
│       ├── middleware/            # JWT auth middleware
│       └── utils/                # SSE event helpers
```

---

## API Overview

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/debates` | Create a new debate |
| `GET` | `/debates` | List user's debates (paginated) |
| `GET` | `/debates/{id}` | Get debate with full turn history |
| `POST` | `/debates/{id}/next-turn` | Stream next debate turn (SSE) |
| `POST` | `/keys` | Save an encrypted API key |
| `GET` | `/keys` | List configured providers |
| `GET` | `/keys/decrypt` | Get decrypted API keys |
| `DELETE` | `/keys/{provider}` | Delete an API key |
