"""
SkillLens AI — FastAPI application entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import connect, disconnect
from app.db.indexes import create_indexes
from app.db.connection import get_db
from app.routers import health
from app.routers import auth as auth_router
from app.routers import resumes as resumes_router
from app.routers import jobs as jobs_router
from app.routers import match as match_router
from app.routers import dashboard as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect to MongoDB and ensure indexes exist."""
    await connect()
    db = get_db()
    await create_indexes(db)
    yield
    await disconnect()


app = FastAPI(
    title="SkillLens AI API",
    version="1.0.0",
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── CORS — strict allowlist ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(resumes_router.router)
app.include_router(jobs_router.router)
app.include_router(match_router.router)
app.include_router(dashboard_router.router)
