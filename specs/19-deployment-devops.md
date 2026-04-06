# Component: Deployment & Local Development Setup

## Overview
Docker configuration for local development, Dockerfiles for production deployment on Railway, environment templates, and the root docker-compose for local Postgres.

## What It Does
- Provides Docker Compose for local PostgreSQL
- Provides Dockerfiles for frontend and backend production builds
- Provides `.env.example` templates for both services
- Provides `.gitignore` for the repository
- Documents Railway deployment configuration

## Files to Create
- `docker-compose.yml` — local Postgres
- `backend/Dockerfile` — production backend image
- `frontend/Dockerfile` — production frontend image
- `backend/.env.example` — backend env template
- `frontend/.env.example` — frontend env template
- `.gitignore` — root gitignore

## Dependencies
- All other components (this wraps the final deployment)
- Docker and Docker Compose
- Railway platform account (for production)

## docker-compose.yml (Local Dev)
```yaml
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

## Backend Dockerfile
- Base: `python:3.11-slim`
- Install `requirements.txt`
- Copy `app/` directory
- CMD: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Expose port 8000

## Frontend Dockerfile
- Base: `node:18-alpine`
- Multi-stage build: install deps → build → production image
- CMD: `npm start`
- Expose port 3000

## Environment Templates

### `backend/.env.example`
```
DATABASE_URL=postgresql+asyncpg://debate:debate_local@localhost:5432/debate_arena
NEXTAUTH_SECRET=local-dev-secret-change-in-production
ENCRYPTION_KEY=<generate-with-fernet>
CORS_ORIGINS=http://localhost:3000
```

### `frontend/.env.example`
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-change-in-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## .gitignore
```
node_modules/
.next/
__pycache__/
*.pyc
.venv/
.env
.env.local
*.db
.DS_Store
dist/
build/
```

## Railway Deployment Config

### Service 1: Frontend
- Source: `/frontend` directory
- Build: `npm run build`
- Start: `npm start`
- Port: 3000
- Domain: `aidebatearena.com`

### Service 2: Backend
- Source: `/backend` directory
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Port: 8000
- Domain: `api.aidebatearena.com`
- Health check: `GET /api/v1/health`

### Service 3: PostgreSQL
- Railway managed Postgres
- Auto-provisioned `DATABASE_URL`

### Environment Variables (Production)
- Generate `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- Generate `ENCRYPTION_KEY`: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- Set `CORS_ORIGINS` to `https://aidebatearena.com`
- Set `NEXTAUTH_URL` to `https://aidebatearena.com`
- Set `NEXT_PUBLIC_API_URL` to `https://api.aidebatearena.com`

## Behavior & Constraints
- Local dev uses Docker only for Postgres — frontend and backend run natively
- Production uses separate Dockerfiles for each service
- The backend Dockerfile should be optimized (copy requirements first, then code, for layer caching)
- The frontend Dockerfile uses multi-stage build to keep the production image small
- All secrets are in environment variables, never committed
- The `.gitignore` must exclude `.env`, `.env.local`, `node_modules`, `__pycache__`, `.venv`

## Relevant Skills
- `docker` — Dockerfile best practices, multi-stage builds
- `railway` — Railway deployment configuration

### Recommended skills.sh Skills
- **docker-expert** — advanced Docker containerization covering Dockerfile optimization, multi-stage builds, layer caching, base image selection, image size reduction, container security, and Docker Compose orchestration
  ```bash
  npx skills add https://github.com/sickn33/antigravity-awesome-skills --skill docker-expert
  ```
- **next-best-practices** — includes guidance on self-hosting Next.js with Docker
  ```bash
  npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
  ```

## Tests to Validate
- **Docker Compose**: `docker compose up` starts Postgres successfully on port 5432
- **Backend Dockerfile**: Builds without errors, starts uvicorn
- **Frontend Dockerfile**: Builds without errors, starts Next.js
- **Env templates**: All required variables are documented in `.env.example`
- **Gitignore**: Sensitive files (`.env`, `.env.local`) are excluded
- **Health check**: Deployed backend responds to `GET /api/v1/health`
- **CORS**: Production backend allows requests from the frontend domain
- **DB connection**: Backend connects to Railway Postgres via `DATABASE_URL`
