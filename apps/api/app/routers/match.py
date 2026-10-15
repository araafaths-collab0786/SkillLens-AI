"""
Match and Gap Analysis routers.

POST /api/v1/match       { resume_id, job_id } → Readiness Index + per-skill breakdown
POST /api/v1/gap-analysis { resume_id, job_id } → gaps, severity, learning path,
                                                   current + projected readiness
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.asynchronous.database import AsyncDatabase

from app.auth.dependencies import get_current_user_id
from app.db.connection import get_db
from app.models.envelope import ok
from app.scoring.esco_relations import get_related_skills
from app.scoring.gap import build_gaps, compute_projected_readiness
from app.scoring.readiness import compute_readiness

router = APIRouter(prefix="/api/v1", tags=["match"])


class MatchRequest(BaseModel):
    resume_id: str
    job_id: str


class GapRequest(BaseModel):
    resume_id: str
    job_id: str


async def _load_resume_and_job(
    resume_id: str,
    job_id: str,
    user_id: str,
    db: AsyncDatabase,
) -> tuple[dict, dict]:
    """Load resume and job docs, raising 404 if not found."""
    resume = await db["resumes"].find_one({"_id": resume_id, "userId": user_id})
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")
    job = await db["jobs"].find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return resume, job


def _candidate_skills_from_resume(resume: dict) -> list[dict]:
    """
    Convert stored resume skills to the format expected by compute_readiness.
    Each skill needs: esco_uri, s, evidence_level, uncalibrated, source_snippet.
    """
    skills = []
    for skill in resume.get("skills", []):
        skills.append({
            "esco_uri":      skill.get("esco_uri", ""),
            "s":             float(skill.get("match_strength", 1.0 if skill.get("match_type") == "exact" else 0.0)),
            "evidence_level": int(skill.get("evidence_level", 1)),
            "uncalibrated":  bool(skill.get("uncalibrated", False)),
            "source_snippet": skill.get("source_snippet", ""),
        })
    return skills


# ── POST /api/v1/match ────────────────────────────────────────────────────────

@router.post("/match")
async def match(
    body: MatchRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    resume, job = await _load_resume_and_job(body.resume_id, body.job_id, user_id, db)

    candidate_skills = _candidate_skills_from_resume(resume)
    required_skills  = job.get("requiredSkills", [])

    result = compute_readiness(candidate_skills, required_skills)

    response_data = {
        "resumeId":      body.resume_id,
        "jobId":         body.job_id,
        "readinessIndex": result.readiness_index,
        "uncalibrated":  result.uncalibrated,
        "skills": [
            {
                "escoId":        s.esco_uri,
                "label":         s.esco_label,
                "weight":        s.weight,
                "s":             s.s,
                "e":             s.e,
                "contribution":  s.contribution,
                "uncalibrated":  s.uncalibrated,
                "evidenceLevel": s.evidence_level,
                "sourceSnippet": s.source_snippet,
            }
            for s in result.skills
        ],
    }

    # Persist match result for dashboard
    await db["matches"].update_one(
        {"userId": user_id, "resumeId": body.resume_id, "jobId": body.job_id},
        {"$set": {
            "userId":         user_id,
            "resumeId":       body.resume_id,
            "jobId":          body.job_id,
            "readinessIndex": result.readiness_index,
            "uncalibrated":   result.uncalibrated,
            "createdAt":      datetime.now(tz=timezone.utc),
        }},
        upsert=True,
    )

    return ok(response_data, uncalibrated=result.uncalibrated)


# ── POST /api/v1/gap-analysis ─────────────────────────────────────────────────

@router.post("/gap-analysis")
async def gap_analysis(
    body: GapRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    resume, job = await _load_resume_and_job(body.resume_id, body.job_id, user_id, db)

    candidate_skills = _candidate_skills_from_resume(resume)
    required_skills  = job.get("requiredSkills", [])
    learning_steps   = job.get("learningSteps", [])

    readiness = compute_readiness(candidate_skills, required_skills)
    gaps      = build_gaps(readiness, learning_steps)
    projected = compute_projected_readiness(gaps, readiness, required_skills)

    # Build the set of candidate skill URIs for transferable-skill lookup
    candidate_uris: set[str] = {cs["esco_uri"] for cs in candidate_skills if cs.get("esco_uri")}

    # Gather all unique transferable skills across all gaps for the panel
    transferable_panel: dict[str, dict] = {}  # escoId → {escoId, label}
    serialised_gaps = []
    for g in gaps:
        related = get_related_skills(g.esco_uri, candidate_uris)
        # Deduplicate by escoId and accumulate panel entries
        for ts in related:
            transferable_panel[ts["escoId"]] = ts

        serialised_gaps.append({
            "escoId":        g.esco_uri,
            "label":         g.esco_label,
            "severity":      g.severity,
            "weight":        g.weight,
            "s":             g.s,
            "e":             g.e,
            "currentSE":     g.current_se,
            "evidenceLevel": g.evidence_level,
            "uncalibrated":  g.uncalibrated,
            "recommendation": g.recommendation,
            "transferableSkills": related,
        })

    gap_response = {
        "resumeId":  body.resume_id,
        "jobId":     body.job_id,
        "gaps": serialised_gaps,
        "transferableSkillsPanel": list(transferable_panel.values()),
        "projectedReadiness": {
            "currentReadiness":   projected.current_readiness,
            "projectedReadiness": projected.projected_readiness,
            "topSteps":           projected.top_steps,
            "uncalibrated":       projected.uncalibrated,
            "disclaimer":         projected.disclaimer,
        },
        "uncalibrated": readiness.uncalibrated,
    }

    # Persist gap analysis for dashboard
    await db["gap_analyses"].update_one(
        {"userId": user_id, "resumeId": body.resume_id, "jobId": body.job_id},
        {"$set": {
            "userId":            user_id,
            "resumeId":          body.resume_id,
            "jobId":             body.job_id,
            "gaps":              serialised_gaps,
            "projectedReadiness": gap_response["projectedReadiness"],
            "createdAt":         datetime.now(tz=timezone.utc),
        }},
        upsert=True,
    )

    return ok(gap_response, uncalibrated=readiness.uncalibrated)
