"""
Readiness Index and Skill Match Score — apps/api/app/scoring/readiness.py

Formula (Section 7):
  Readiness = 100 × Σ_i (s_i × e_i × w_i) / Σ_i w_i
  Clamped to [0, 100], rounded to nearest integer.

s_i = semantic match strength (1.0 for exact alias match; UNCALIBRATED for semantic)
e_i = evidence multiplier
w_i = job-defined weight ∈ {1, 2, 3}

Any result that involves an uncalibrated semantic match carries uncalibrated=True.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.scoring.constants import EVIDENCE_MULTIPLIER


@dataclass
class SkillScore:
    esco_uri: str
    esco_label: str
    weight: int              # w_i ∈ {1, 2, 3}
    s: float                 # semantic match strength [0, 1]
    e: float                 # evidence multiplier [0, 1]
    contribution: float      # s × e × w (numerator contribution)
    uncalibrated: bool       # True if s came from an uncalibrated semantic match
    evidence_level: int      # 0–3
    source_snippet: str = ""


@dataclass
class ReadinessResult:
    readiness_index: int        # 0–100, clamped and rounded
    skills: list[SkillScore]
    uncalibrated: bool          # True if any skill used uncalibrated semantic match
    total_weight: int
    weighted_score_sum: float


def compute_readiness(
    candidate_skills: list[dict],
    required_skills: list[dict],
) -> ReadinessResult:
    """
    Compute the Readiness Index for a candidate against a job's required skills.

    Args:
        candidate_skills: List of dicts with keys:
            esco_uri, s (match strength), evidence_level, uncalibrated, source_snippet
        required_skills: List of dicts with keys:
            esco_uri, esco_label, weight

    Returns:
        ReadinessResult
    """
    # Build lookup: esco_uri → candidate skill data
    candidate_map: dict[str, dict] = {cs["esco_uri"]: cs for cs in candidate_skills}

    skill_scores: list[SkillScore] = []
    total_weight = 0
    weighted_sum = 0.0
    any_uncalibrated = False

    for req in required_skills:
        uri = req["esco_uri"]
        w = int(req["weight"])
        label = req.get("esco_label", uri)

        if uri in candidate_map:
            cs = candidate_map[uri]
            s = float(cs.get("s", 0.0))
            e_level = int(cs.get("evidence_level", 0))
            e = EVIDENCE_MULTIPLIER.get(e_level, 0.0)
            uncalibrated = bool(cs.get("uncalibrated", False))
        else:
            # Missing skill
            s = 0.0
            e = 0.0
            e_level = 0
            uncalibrated = False

        contribution = s * e * w
        total_weight += w
        weighted_sum += contribution
        if uncalibrated:
            any_uncalibrated = True

        skill_scores.append(SkillScore(
            esco_uri=uri,
            esco_label=label,
            weight=w,
            s=round(s, 4),
            e=round(e, 4),
            contribution=round(contribution, 4),
            uncalibrated=uncalibrated,
            evidence_level=e_level,
            source_snippet=candidate_map.get(uri, {}).get("source_snippet", ""),
        ))

    if total_weight == 0:
        raw_readiness = 0.0
    else:
        raw_readiness = 100.0 * weighted_sum / total_weight

    readiness_index = max(0, min(100, round(raw_readiness)))

    return ReadinessResult(
        readiness_index=readiness_index,
        skills=skill_scores,
        uncalibrated=any_uncalibrated,
        total_weight=total_weight,
        weighted_score_sum=round(weighted_sum, 4),
    )
