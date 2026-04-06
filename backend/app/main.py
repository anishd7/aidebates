"""FastAPI application entrypoint with CORS, lifespan, and router registration."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory, engine, init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup: create tables and clean up stale running debates. Shutdown: dispose engine."""
    # Startup
    await init_db()

    # Set any debates stuck in 'running' status back to 'paused'
    async with async_session_factory() as session:
        await session.execute(
            text("UPDATE debates SET status = 'paused' WHERE status = 'running'")
        )
        await session.commit()

    yield

    # Shutdown
    await engine.dispose()


app = FastAPI(title="AI Debate Arena", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api/v1
from app.routers.health import router as health_router  # noqa: E402
from app.routers.keys import router as keys_router  # noqa: E402
from app.routers.debates import router as debates_router  # noqa: E402
from app.routers.turns import router as turns_router  # noqa: E402

app.include_router(health_router, prefix="/api/v1")
app.include_router(keys_router, prefix="/api/v1")
app.include_router(debates_router, prefix="/api/v1")
app.include_router(turns_router, prefix="/api/v1")
