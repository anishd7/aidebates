# Component: Backend Config & App Setup

## Overview
FastAPI application initialization, configuration management via pydantic-settings, CORS middleware, lifespan handler for DB init and cleanup, and the health endpoint.

## What It Does
- Loads environment variables into a typed `Settings` object
- Initializes the FastAPI app with CORS, lifespan events
- On startup: creates DB tables, runs cleanup (set stale `running` debates to `paused`)
- Exposes a `GET /api/v1/health` endpoint
- Configures the `/api/v1` prefix for all routers

## Files to Create
- `backend/app/config.py` — `Settings` class using `pydantic-settings`
- `backend/app/main.py` — FastAPI app, CORS, lifespan, router registration
- `backend/app/routers/__init__.py`
- `backend/app/routers/health.py` — health check endpoint
- `backend/app/__init__.py`
- `backend/requirements.txt` — all Python dependencies
- `backend/.env.example` — template environment file

## Dependencies
- `fastapi>=0.110`
- `uvicorn[standard]>=0.29`
- `pydantic-settings>=2.2`
- `python-dotenv>=1.0`
- Component `01-database-models` (for `init_db()`)

## Inputs (Environment Variables)
| Variable         | Required | Description                                |
|------------------|----------|--------------------------------------------|
| DATABASE_URL     | Yes      | PostgreSQL async connection string         |
| NEXTAUTH_SECRET  | Yes      | Shared JWT secret with Next.js frontend    |
| ENCRYPTION_KEY   | Yes      | Fernet key for API key encryption          |
| CORS_ORIGINS     | Yes      | Comma-separated allowed origins            |

## Outputs
- Running FastAPI application on port 8000
- `settings` singleton accessible via `from app.config import settings`
- Health check at `GET /api/v1/health`

## Behavior & Constraints
- `Settings` uses `pydantic-settings` with `env_file=".env"` support
- CORS allows credentials, all methods, all headers from configured origins
- Lifespan startup:
  1. Call `init_db()` to create tables
  2. Run cleanup query: `UPDATE debates SET status = 'paused' WHERE status = 'running'`
- Health endpoint returns `{"status": "healthy", "timestamp": "<ISO8601>"}` with 200
- All API routers mounted under `/api/v1` prefix

## Relevant Skills
- `fastapi` — app setup, lifespan, middleware
- `python` — pydantic-settings configuration

### Recommended skills.sh Skills
- **fastapi-templates** — production-ready FastAPI project structure with lifespan management, middleware setup, and layered architecture
  ```bash
  npx skills add https://github.com/wshobson/agents --skill fastapi-templates
  ```
- **async-python-patterns** — async/await patterns including proper lifespan and event loop management
  ```bash
  npx skills add https://github.com/wshobson/agents --skill async-python-patterns
  ```

## Tests to Validate
- **Health endpoint**: `GET /api/v1/health` returns 200 with expected JSON shape
- **Settings loading**: `Settings` correctly reads from environment variables
- **Settings validation**: Missing required env vars raise a validation error
- **CORS headers**: Response includes correct CORS headers for configured origin
- **CORS rejection**: Request from non-allowed origin does not include CORS headers
- **Startup cleanup**: After startup, any debates with `status='running'` are set to `'paused'`
