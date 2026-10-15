"""
Dashboard router — GET /api/v1/dashboard

Returns aggregated data for the authenticated user's dashboard:
  - latestResume: most recent resume with status and readiness (if matched)
  - recentResumes: list of recent submissions (status, intakeMethod, createdAt)
  - topGaps: top 3 gap labels from the latest match, for the summary cards
  - learningSteps: active top-3 learning steps from the latest gap analysis

This is a lightweight aggregation — it does not run the full scoring pipeline.
It reads from stored resume, match, and gap data in MongoDB.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pymongo.asynchronous.database import AsyncDatabase

from app.auth.dependencies import get_current_user_id
from app.db.connection import get_db
from app.models.envelope import ok

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(
    user_id: str = Depends(get_current_user_id),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    # ── Recent resumes (last 5) ─────────────────────────────────────────────
    cursor = db["resumes"].find(
        {"userId": user_id},
        sort=[("createdAt", -1)],
    ).limit(5)

    recent_resumes = []
    latest_resume = None
    async for doc in cursor:
        entry = {
            "id":           str(doc["_id"]),
            "intakeMethod": doc.get("intakeMethod", "pdf_upload"),
            "status":       doc.get("status", "synced"),
            "createdAt":    _fmt_dt(doc.get("createdAt")),
            "skillCount":   len(doc.get("skills", [])),
        }
        if latest_resume is None:
            latest_resume = entry
        recent_resumes.append(entry)

    # ── Latest match result ─────────────────────────────────────────────────
    # Stored as a separate "matches" collection (written by the match endpoint)
    latest_match = await db["matches"].find_one(
        {"userId": user_id},
        sort=[("createdAt", -1)],
    )

    readiness_index = None
    job_title = None
    if latest_match:
        readiness_index = latest_match.get("readinessIndex")
        # Fetch the job title from the job document
        job_doc = await db["jobs"].find_one({"_id": latest_match.get("jobId")})
        if job_doc:
            job_title = job_doc.get("title")

    # ── Latest gap analysis ─────────────────────────────────────────────────
    latest_gap = await db["gap_analyses"].find_one(
        {"userId": user_id},
        sort=[("createdAt", -1)],
    )

    top_gaps: list[dict] = []
    active_steps: list[dict] = []
    if latest_gap:
        gaps = latest_gap.get("gaps", [])
        top_gaps = [
            {
                "label":    g.get("label", ""),
                "severity": g.get("severity", "Low"),
                "weight":   g.get("weight", 1),
            }
            for g in gaps[:3]
        ]
        projected = latest_gap.get("projectedReadiness", {})
        active_steps = [
            {
                "escoLabel":    s.get("escoLabel", ""),
                "effortWeeks":  s.get("effortWeeks", 0),
                "gainDelta":    s.get("gainDelta", 0.0),
                "stepOrder":    s.get("stepOrder", 99),
            }
            for s in projected.get("topSteps", [])
        ]

    return ok({
        "latestResume": latest_resume,
        "recentResumes": recent_resumes,
        "readinessIndex": readiness_index,
        "jobTitle": job_title,
        "topGaps": top_gaps,
        "activeSteps": active_steps,
        "resumeId": latest_match.get("resumeId") if latest_match else None,
        "jobId":    latest_match.get("jobId")    if latest_match else None,
    })


def _fmt_dt(value) -> str:
    if value is None:
        return datetime.now(tz=timezone.utc).isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
