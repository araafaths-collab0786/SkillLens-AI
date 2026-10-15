"""
Health check router.
GET /health — returns 200 when the API is up; reports DB status.
"""

import time
from fastapi import APIRouter
from pydantic import BaseModel

from app.db.connection import get_db

router = APIRouter(tags=["health"])

_start_time = time.time()


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    db_connected: bool
    db_driver: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    db_ok = False
    try:
        db = get_db()
        await db.client.admin.command("ping")
        db_ok = True
    except Exception:
        pass

    return HealthResponse(
        status="ok",
        uptime_seconds=round(time.time() - _start_time, 1),
        db_connected=db_ok,
        db_driver="pymongo.AsyncMongoClient >= 4.7 (Gate 1 approved 2025-07-11)",
    )
