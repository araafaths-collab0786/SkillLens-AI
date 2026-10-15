"""
Jobs router — GET /api/v1/jobs, GET /api/v1/jobs/{id}
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.asynchronous.database import AsyncDatabase

from app.auth.dependencies import get_current_user_id
from app.db.connection import get_db
from app.models.envelope import ok

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.get("")
async def list_jobs(
    category: str | None = Query(default=None),
    search:   str | None = Query(default=None),
    db: AsyncDatabase = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    query: dict = {}
    if category:
        query["category"] = category
    if search:
        query["title"] = {"$regex": search, "$options": "i"}

    cursor = db["jobs"].find(query)
    jobs = []
    async for doc in cursor:
        jobs.append(_format_job(doc))
    return ok({"jobs": jobs})


@router.get("/{job_id}")
async def get_job(
    job_id: str,
    db: AsyncDatabase = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    doc = await db["jobs"].find_one({"_id": job_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found.")
    return ok(_format_job(doc))


def _format_job(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "title": doc["title"],
        "category": doc["category"],
        "requiredSkills": doc.get("requiredSkills", []),
        "niceToHaveSkills": doc.get("niceToHaveSkills", []),
        "sdgAligned": doc.get("sdgAligned", True),
        "createdAt": doc.get("createdAt", datetime.now(tz=timezone.utc)).isoformat()
            if hasattr(doc.get("createdAt"), "isoformat") else str(doc.get("createdAt", "")),
    }
