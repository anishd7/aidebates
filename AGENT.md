# AI Debate Arena - Agent Guide

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, OpenAI Agents SDK (`openai-agents`), LiteLLM, SQLAlchemy 2.0 (async), asyncpg
- **Frontend:** Next.js 14+ (App Router), shadcn/ui, Tailwind CSS, Zustand, NextAuth.js v5
- **Database:** PostgreSQL 16
- **Deployment:** Railway (frontend + backend + managed Postgres)

## Project Structure

```
ai-debate-arena/
├── frontend/          # Next.js app
├── backend/           # FastAPI app
├── docker-compose.yml # Local Postgres
├── specs/             # Component specifications
├── fix_plan.md        # Task tracker (AI-maintained)
└── PROMPT.md          # Loop instructions
```

## Setup

### Database (local)

```bash
docker compose up -d
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY, CORS_ORIGINS
uvicorn app.main:app --reload --port 8000
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

```bash
# Backend
cd backend && python -m pytest

# Frontend
cd frontend && npm test
```

## Key SDK Imports

```python
from agents import Agent, Runner, OpenAIResponsesModel
from agents.extensions.models.litellm_provider import LitellmModel
from agents.items import MessageOutputItem, ItemHelpers
from openai.types.responses import ResponseTextDeltaEvent
```

## Notes

(AI will add learnings here as it works)
