# Component: Database Models & Connection

## Overview
SQLAlchemy 2.0 async ORM models and database connection setup for PostgreSQL. This is the data foundation for the entire application.

## What It Does
- Defines the four core tables: `users`, `user_api_keys`, `debates`, `turns`
- Establishes async database engine and session factory using `asyncpg`
- Creates tables on startup via `Base.metadata.create_all()` (idempotent)
- Provides a reusable async session dependency for FastAPI

## Files to Create
- `backend/app/database.py` — async engine, session factory, `get_db` dependency
- `backend/app/models/__init__.py` — re-exports all models
- `backend/app/models/user.py` — `User` model
- `backend/app/models/api_key.py` — `UserApiKey` model
- `backend/app/models/debate.py` — `Debate` model
- `backend/app/models/turn.py` — `Turn` model

## Dependencies
- `sqlalchemy[asyncio]>=2.0`
- `asyncpg>=0.29`
- Component `02-backend-config` (for `DATABASE_URL` from settings)

## Inputs
- `DATABASE_URL` environment variable (format: `postgresql+asyncpg://user:pass@host:port/db`)

## Outputs
- `AsyncSession` factory for use in route handlers
- SQLAlchemy `Base` with all table metadata
- `init_db()` async function that calls `create_all()`

## Schema Details

### `users` table
| Column       | Type         | Constraints                        |
|--------------|--------------|------------------------------------|
| id           | UUID         | PK, default `gen_random_uuid()`    |
| email        | VARCHAR(255) | UNIQUE, NOT NULL                   |
| name         | VARCHAR(255) | nullable                           |
| avatar_url   | TEXT         | nullable                           |
| created_at   | TIMESTAMPTZ  | NOT NULL, default `now()`          |
| updated_at   | TIMESTAMPTZ  | NOT NULL, default `now()`          |

### `user_api_keys` table
| Column        | Type        | Constraints                        |
|---------------|-------------|------------------------------------|
| id            | UUID        | PK, default `gen_random_uuid()`    |
| user_id       | UUID        | FK -> users(id), NOT NULL          |
| provider      | VARCHAR(50) | NOT NULL ("openai" or "anthropic") |
| encrypted_key | TEXT        | NOT NULL                           |
| key_last_four | VARCHAR(4)  | NOT NULL                           |
| created_at    | TIMESTAMPTZ | NOT NULL, default `now()`          |
| updated_at    | TIMESTAMPTZ | NOT NULL, default `now()`          |
| UNIQUE(user_id, provider) |  |                                    |

### `debates` table
| Column          | Type        | Constraints                        |
|-----------------|-------------|------------------------------------|
| id              | UUID        | PK, default `gen_random_uuid()`    |
| user_id         | UUID        | FK -> users(id), NOT NULL          |
| topic           | TEXT        | NOT NULL                           |
| agent_a_config  | JSONB       | NOT NULL                           |
| agent_b_config  | JSONB       | NOT NULL                           |
| status          | VARCHAR(20) | NOT NULL, default 'created'        |
| current_turn    | INTEGER     | NOT NULL, default 0                |
| max_turns       | INTEGER     | NOT NULL, default 100              |
| created_at      | TIMESTAMPTZ | NOT NULL, default `now()`          |
| updated_at      | TIMESTAMPTZ | NOT NULL, default `now()`          |

Agent config JSON shape: `{ "name": str, "personality": str, "provider": str, "model": str }`

Status values: `created`, `running`, `paused`, `completed`

### `turns` table
| Column       | Type         | Constraints                        |
|--------------|--------------|------------------------------------|
| id           | UUID         | PK, default `gen_random_uuid()`    |
| debate_id    | UUID         | FK -> debates(id), NOT NULL        |
| turn_number  | INTEGER      | NOT NULL                           |
| agent_name   | VARCHAR(255) | NOT NULL                           |
| agent_side   | VARCHAR(1)   | NOT NULL ("a" or "b")              |
| content      | TEXT         | NOT NULL                           |
| model_used   | VARCHAR(100) | NOT NULL                           |
| created_at   | TIMESTAMPTZ  | NOT NULL, default `now()`          |
| UNIQUE(debate_id, turn_number) |  |                              |

### Indexes
- `idx_debates_user_id` on `debates(user_id)`
- `idx_debates_status` on `debates(status)`
- `idx_turns_debate_id` on `turns(debate_id, turn_number)`
- `idx_user_api_keys_user_id` on `user_api_keys(user_id)`

## Behavior & Constraints
- All UUIDs use `uuid.uuid4()` via SQLAlchemy's `server_default` or Python-side default
- `updated_at` should auto-update on row modification (use `onupdate=func.now()`)
- The `UNIQUE(debate_id, turn_number)` constraint is critical for preventing duplicate turns during crash recovery
- The `UNIQUE(user_id, provider)` constraint enforces one key per provider per user
- JSONB columns (`agent_a_config`, `agent_b_config`) store agent configuration as structured JSON
- `get_db()` yields an `AsyncSession` and is used as a FastAPI `Depends()`
- The engine should use connection pooling defaults from SQLAlchemy

## Relevant Skills
- `python` — SQLAlchemy 2.0 async patterns
- `fastapi` — dependency injection with async sessions

### Recommended skills.sh Skills
- **async-python-patterns** — async/await patterns for Python, covers async database operations and event loops
  ```bash
  npx skills add https://github.com/wshobson/agents --skill async-python-patterns
  ```
- **postgresql-table-design** — PostgreSQL schema design best practices
  ```bash
  npx skills add https://github.com/wshobson/agents --skill postgresql-table-design
  ```
- **fastapi-templates** — production-ready FastAPI project structure with async patterns and dependency injection
  ```bash
  npx skills add https://github.com/wshobson/agents --skill fastapi-templates
  ```

## Tests to Validate
- **Model creation**: Each model can be instantiated with valid data
- **Table creation**: `init_db()` creates all four tables (use a test database)
- **Unique constraints**: Inserting duplicate `(user_id, provider)` in `user_api_keys` raises IntegrityError
- **Unique constraints**: Inserting duplicate `(debate_id, turn_number)` in `turns` raises IntegrityError
- **Foreign keys**: Inserting a debate with a non-existent `user_id` raises IntegrityError
- **JSONB round-trip**: Agent config stored and retrieved correctly from JSONB columns
- **Session lifecycle**: `get_db()` yields a working session and closes it after use
- **Idempotent create**: Calling `init_db()` twice does not error
