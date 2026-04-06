# AI Debate Arena — Build Plan

Every task needed to build the project, sorted by priority and dependency order.

---

## Phase 1: Project Scaffolding & Infrastructure

- [x] **1.1** Create root `.gitignore` (node_modules, .next, __pycache__, .venv, .env, .env.local, .DS_Store, dist, build)
- [x] **1.2** Create `docker-compose.yml` with local PostgreSQL 16 (user: debate, password: debate_local, db: debate_arena, port 5432)
- [x] **1.3** Create `backend/.env.example` with DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY, CORS_ORIGINS
- [x] **1.4** Create `frontend/.env.example` with NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_API_URL

## Phase 2: Backend Foundation

- [x] **2.1** Create `backend/pyproject.toml` with all Python dependencies via uv (fastapi, uvicorn, pydantic-settings, python-dotenv, sqlalchemy[asyncio], asyncpg, cryptography, python-jose[cryptography], openai-agents, openai, litellm, sse-starlette, httpx)
- [x] **2.2** Create `backend/app/__init__.py`
- [x] **2.3** Create `backend/app/config.py` — `Settings` class using pydantic-settings (DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY, CORS_ORIGINS)
- [x] **2.4** Create `backend/app/database.py` — async engine, session factory (`AsyncSession`), `get_db` FastAPI dependency, `init_db()` function
- [x] **2.5** Create `backend/app/models/__init__.py` — re-export all models
- [x] **2.6** Create `backend/app/models/user.py` — `User` model (id, email, name, avatar_url, created_at, updated_at)
- [x] **2.7** Create `backend/app/models/api_key.py` — `UserApiKey` model (id, user_id FK, provider, encrypted_key, key_last_four, created_at, updated_at; UNIQUE user_id+provider)
- [x] **2.8** Create `backend/app/models/debate.py` — `Debate` model (id, user_id FK, topic, agent_a_config JSONB, agent_b_config JSONB, status, current_turn, max_turns, created_at, updated_at; indexes on user_id, status)
- [x] **2.9** Create `backend/app/models/turn.py` — `Turn` model (id, debate_id FK, turn_number, agent_name, agent_side, content, model_used, created_at; UNIQUE debate_id+turn_number; index on debate_id+turn_number)

## Phase 3: Backend Services

- [x] **3.1** Create `backend/app/services/__init__.py`
- [x] **3.2** Create `backend/app/services/encryption.py` — `encrypt_key()`, `decrypt_key()`, `get_key_last_four()` using Fernet with ENCRYPTION_KEY
- [x] **3.3** Create `backend/app/middleware/__init__.py`
- [x] **3.4** Create `backend/app/middleware/auth.py` — `get_current_user()` (JWT validation with python-jose, HS256, user creation on first auth) and `get_optional_user()` (returns None if no token)

## Phase 4: Backend API Endpoints

- [x] **4.1** Create `backend/app/routers/__init__.py`
- [x] **4.2** Create `backend/app/routers/health.py` — `GET /api/v1/health` returning `{"status": "healthy", "timestamp": "<ISO8601>"}`
- [x] **4.3** Create `backend/app/schemas/__init__.py`
- [x] **4.4** Create `backend/app/schemas/keys.py` — Pydantic schemas: `SaveKeyRequest`, `KeyInfo`, `KeyListResponse`, `DecryptedKeysResponse`
- [x] **4.5** Create `backend/app/routers/keys.py` — `POST /api/v1/keys` (upsert), `GET /api/v1/keys` (list masked), `GET /api/v1/keys/decrypt`, `DELETE /api/v1/keys/{provider}`
- [x] **4.6** Create `backend/app/schemas/debates.py` — Pydantic schemas: `AgentConfigInput`, `CreateDebateRequest`, `DebateResponse`, `DebateListItem`, `DebateListResponse`
- [x] **4.7** Create `backend/app/schemas/turns.py` — `TurnResponse` schema
- [x] **4.8** Create `backend/app/routers/debates.py` — `POST /api/v1/debates` (create with provider key check), `GET /api/v1/debates` (list paginated with optional status filter), `GET /api/v1/debates/{id}` (get with optional auth for public sharing)

## Phase 5: Backend Debate Engine

- [x] **5.1** Create `backend/app/services/agent_factory.py` — `create_agent()` (OpenAI via `OpenAIResponsesModel`, Anthropic via `LitellmModel` with "anthropic/" prefix), `build_system_prompt()`
- [ ] **5.2** Create `backend/app/utils/__init__.py`
- [ ] **5.3** Create `backend/app/utils/sse.py` — SSE event formatting helpers for turn_start, token, turn_complete, error events
- [ ] **5.4** Create `backend/app/services/debate_orchestrator.py` — `build_agent_input()` (conversation reconstruction with role mapping), `classify_error()`, streaming orchestration logic
- [ ] **5.5** Create `backend/app/routers/turns.py` — `POST /api/v1/debates/{id}/next-turn` (determine agent, validate API key header, reconstruct conversation, stream via SSE, atomic save turn + increment current_turn, error handling with pause)

## Phase 6: Backend App Entrypoint

- [ ] **6.1** Create `backend/app/main.py` — FastAPI app with CORS middleware, lifespan (init_db + cleanup stale running→paused debates), register all routers under `/api/v1`

## Phase 7: Frontend Foundation

- [ ] **7.1** Initialize Next.js 14+ project in `frontend/` with TypeScript, App Router, Tailwind CSS
- [ ] **7.2** Configure `tailwind.config.ts`, `postcss.config.js`, `frontend/app/globals.css` with shadcn/ui CSS variables
- [ ] **7.3** Install shadcn/ui and required components (button, card, dialog, input, label, select, textarea, avatar, scroll-area, separator, sheet, badge, dropdown-menu, tooltip)
- [ ] **7.4** Create `frontend/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- [ ] **7.5** Create `frontend/types/index.ts` — shared TypeScript types (AgentConfig, Debate, DebateListItem, Turn, ApiKeys, etc.)
- [ ] **7.6** Create `frontend/lib/auth.ts` — NextAuth config with Google OAuth, JWT strategy, callbacks (jwt: store userId, session: expose userId)
- [ ] **7.7** Create `frontend/app/api/auth/[...nextauth]/route.ts` — NextAuth API route handler
- [ ] **7.8** Create `frontend/components/providers.tsx` — client-side `SessionProvider` wrapper
- [ ] **7.9** Create `frontend/app/layout.tsx` — root layout wrapping with providers

## Phase 8: Frontend API & State Layer

- [ ] **8.1** Create `frontend/lib/api.ts` — typed `apiFetch<T>()` wrapper with JWT auth header, all API methods (saveKey, listKeys, decryptKeys, deleteKey, createDebate, listDebates, getDebate, getSharedDebate)
- [ ] **8.2** Create `frontend/lib/sse.ts` — `parseSSEEvents(buffer)` returning `{ parsed: SSEEvent[], remaining: string }`
- [ ] **8.3** Create `frontend/stores/apiKeys.ts` — Zustand store for API keys (fetchKeys, refreshKeys, hasKey, clearKeys; keys in memory only, never localStorage)
- [ ] **8.4** Create `frontend/stores/debateManager.ts` — Zustand store for debate loop (startDebate, resumeDebate, pauseDebate, getDebate, clearDebate; runDebateLoop with SSE consumption, token accumulation, turn_complete finalization, error handling, 409 retry, AbortController for pause)

## Phase 9: Frontend App Shell & Layout

- [ ] **9.1** Create `frontend/components/layout/Header.tsx` — logo, mobile hamburger, user avatar with dropdown (name, email, Settings link, Sign Out)
- [ ] **9.2** Create `frontend/components/layout/Sidebar.tsx` — "+ New Debate" button, scrollable debate list (topic truncated, status badge with pulsing dot for running, agent names), active highlight, mobile sheet
- [ ] **9.3** Create `frontend/components/layout/AppShell.tsx` — composes Header + Sidebar + children content area
- [ ] **9.4** Create `frontend/app/(app)/layout.tsx` — auth check (redirect to /login if unauthenticated), renders AppShell, calls fetchKeys() and loads debate list on mount
- [ ] **9.5** Create `frontend/app/(app)/page.tsx` — redirect to /app/debates or /app/new

## Phase 10: Frontend Pages — Create Debate

- [ ] **10.1** Create `frontend/components/debate/AgentConfig.tsx` — reusable agent config sub-form (name, provider select, model select filtered by provider, personality textarea)
- [ ] **10.2** Create `frontend/components/debate/CreateDebateForm.tsx` — topic textarea, two AgentConfig panels (blue/green accents), max turns input, submit flow (validate, check hasKey, call createDebate, navigate to debate view, start loop)
- [ ] **10.3** Create `frontend/app/(app)/new/page.tsx` — renders CreateDebateForm

## Phase 11: Frontend Pages — Debate View

- [ ] **11.1** Create `frontend/components/debate/StreamingText.tsx` — renders content with blinking `█` cursor when isStreaming=true, plain markdown when false
- [ ] **11.2** Create `frontend/components/debate/DebateMessage.tsx` — single message bubble (agent name + model in header, turn number, markdown content via react-markdown, blue-50 for agent A, emerald-50 for agent B)
- [ ] **11.3** Create `frontend/components/debate/DebateStatus.tsx` — status badge/header (topic, running/paused/completed indicator, turn counter, agent info)
- [ ] **11.4** Create `frontend/components/debate/DebateView.tsx` — message list with auto-scroll (pause on manual scroll up, resume at bottom), Pause button, Resume button for paused, Share button for completed, error display
- [ ] **11.5** Create `frontend/app/(app)/debate/[id]/page.tsx` — load debate from DebateManager or API, auto-start if status=created, show Resume for paused/running

## Phase 12: Frontend Pages — Settings

- [ ] **12.1** Create `frontend/components/settings/ApiKeyForm.tsx` — per-provider card (not configured / configured states, add/update with password input + show/hide toggle, delete with confirmation, inline success/error feedback, calls refreshKeys after changes)
- [ ] **12.2** Create `frontend/app/(app)/settings/page.tsx` — renders ApiKeyForm for OpenAI and Anthropic

## Phase 13: Frontend Pages — Public Pages

- [ ] **13.1** Create `frontend/app/page.tsx` — landing page (navbar with logo + Sign In, hero section, 3 feature cards, footer)
- [ ] **13.2** Create `frontend/app/(auth)/login/page.tsx` — login page with Google OAuth button (signIn('google')), redirect to /app if already authenticated
- [ ] **13.3** Create `frontend/app/shared/[id]/page.tsx` — public shared debate view (no auth, fetch via getSharedDebate, reuse DebateMessage, SEO metadata from debate topic, 404 for non-completed, CTA to landing page)

## Phase 14: Dockerfiles

- [ ] **14.1** Create `backend/Dockerfile` — python:3.11-slim, install requirements first (layer caching), copy app, CMD uvicorn, expose 8000
- [ ] **14.2** Create `frontend/Dockerfile` — node:18-alpine, multi-stage build (install → build → production), CMD npm start, expose 3000

## Phase 15: Integration Testing & Polish

- [ ] **15.1** Verify local dev setup: `docker compose up` for Postgres, backend runs on 8000, frontend on 3000
- [ ] **15.2** Test end-to-end auth flow: Google OAuth → JWT → backend validates → user created in DB
- [ ] **15.3** Test API key management: save, list, decrypt, delete keys through the Settings UI
- [ ] **15.4** Test debate creation: fill form, submit, verify debate created in DB with correct config
- [ ] **15.5** Test debate streaming: start debate, verify SSE events (turn_start, tokens, turn_complete), turns saved to DB, current_turn increments
- [ ] **15.6** Test pause/resume: pause mid-debate, verify status=paused, resume picks up from correct turn
- [ ] **15.7** Test debate completion: run to max_turns, verify status=completed, share URL works for unauthenticated users
- [ ] **15.8** Test error handling: invalid API key → error SSE event → debate paused → recoverable resume
- [ ] **15.9** Test crash recovery: simulate server restart mid-debate, verify current_turn unchanged, retry works
- [ ] **15.10** Test concurrent safety: two requests for same turn → one succeeds, one gets 409

## Phase 16: Deployment

- [ ] **16.1** Create Railway project with 3 services (frontend, backend, managed Postgres)
- [ ] **16.2** Configure production environment variables (generate NEXTAUTH_SECRET, ENCRYPTION_KEY; set CORS_ORIGINS, NEXTAUTH_URL, NEXT_PUBLIC_API_URL)
- [ ] **16.3** Configure custom domains (aidebatearena.com for frontend, api.aidebatearena.com for backend)
- [ ] **16.4** Set up Google OAuth credentials for production domain
- [ ] **16.5** Deploy and verify health check at `GET /api/v1/health`
- [ ] **16.6** Smoke test full flow in production: sign in → add keys → create debate → watch streaming → share completed debate
