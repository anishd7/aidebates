# AI Debate Arena - Agent Guide

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, OpenAI Agents SDK (`openai-agents`), LiteLLM, SQLAlchemy 2.0 (async), asyncpg
- **Frontend:** Next.js 14+ (App Router), shadcn/ui, Tailwind CSS, Zustand, NextAuth.js v5
- **Database:** PostgreSQL 16
- **Deployment:** Railway (frontend + backend + managed Postgres)

## Project Structure

```
ai-debate-arena/
├── frontend/              # Next.js app
│   └── .env.example       # Frontend env template
├── backend/               # FastAPI app (managed by uv)
│   ├── pyproject.toml     # Dependencies & project config
│   ├── uv.lock            # Lockfile
│   ├── .env.example       # Backend env template
│   ├── app/
│   │   ├── config.py      # Settings (pydantic-settings)
│   │   ├── database.py    # Async engine, session, init_db
│   │   ├── services/      # Business logic (encryption, agent factory, orchestrator)
│   │   └── models/        # SQLAlchemy models (User, UserApiKey, Debate, Turn)
│   └── tests/             # pytest tests (run against local Postgres)
├── docker-compose.yml     # Local Postgres 16 (port 5432)
├── .gitignore             # Root gitignore
├── specs/                 # Component specifications
├── fix_plan.md            # Task tracker (AI-maintained)
└── PROMPT.md              # Loop instructions
```

## Setup

### Database (local)

```bash
docker compose up -d
```

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env: DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY, CORS_ORIGINS
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npx shadcn-ui@latest init
cp .env.example .env.local
# Edit .env.local: NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_API_URL
npm run dev
```

## Tests

Requires local Postgres running (`docker compose up -d`).

```bash
# Backend (from backend/ dir)
uv run pytest

# Frontend
cd frontend && npm test
```

## Installing agent skills (Skills CLI)

Skills extend the agent with reusable workflows and domain knowledge. This project uses the open skills ecosystem ([skills.sh](https://skills.sh/)); the package manager is **`npx skills`** (requires Node/npm).

| Action | Command |
|--------|---------|
| Search | `npx skills find [query]` |
| Install a skill | `npx skills add <owner/repo@skill-name>` |
| Install globally (user-level), no prompts | `npx skills add <owner/repo@skill-name> -g -y` |
| Check for updates | `npx skills check` |
| Update installed skills | `npx skills update` |
| Scaffold a new skill | `npx skills init <skill-name>` |

**Examples:**

```bash
npx skills find nextjs testing
npx skills add vercel-labs/agent-skills@react-best-practices -g -y
```

Prefer skills with high install counts and reputable sources (`anthropics`, `vercel-labs`, etc.). If unsure, search the [leaderboard](https://skills.sh/) first, then use `npx skills find` with specific keywords.

## Key SDK Imports

```python
from agents import Agent, Runner, OpenAIResponsesModel
from agents.extensions.models.litellm_provider import LitellmModel
from agents.items import MessageOutputItem, ItemHelpers
from openai.types.responses import ResponseTextDeltaEvent
```

## Notes

- Uses `uv` for Python package management (not pip/venv). Use `uv add`, `uv run`, etc.
- Tests run against local PostgreSQL (docker-compose), not SQLite — models use native PG types (JSONB, UUID).
- pytest-asyncio mode is `strict` — tests must be marked with `@pytest.mark.asyncio`.
