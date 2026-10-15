"""
Gap severity classifier — apps/api/app/scoring/gap.py

Classifies each skill gap by severity (High / Medium / Low) per Section 7.
Also computes projected readiness for the top 3 learning steps.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.scoring.constants import (
    EVIDENCE_MULTIPLIER,
    GAP_HIGH_SE_MAX,
    GAP_HIGH_WEIGHT,
    GAP_MED_ALT_SE_MAX,
    GAP_MED_SE_MAX,
    GAP_MED_WEIGHT,
    PROJECTION_UPGRADES,
)
from app.scoring.readiness import ReadinessResult, SkillScore, compute_readiness

DISCLAIMER_PROJECTED = (
    "Estimated. Assumes the steps are completed and evidence is submitted and checked. "
    "Does not predict hiring outcomes."
)


@dataclass
class Gap:
    esco_uri: str
    esco_label: str
    severity: str              # "High" | "Medium" | "Low"
    weight: int
    s: float
    e: float
    current_se: float          # s × e
    evidence_level: int
    uncalibrated: bool
    recommendation: dict       # {type, title, effortWeeks, targetEvidenceLevel, stepOrder}
    transferable_skills: list[dict] = field(default_factory=list)


@dataclass
class ProjectedReadiness:
    current_readiness: int
    projected_readiness: int
    top_steps: list[dict]
    uncalibrated: bool
    disclaimer: str = DISCLAIMER_PROJECTED


def classify_severity(weight: int, s: float, e: float) -> str | None:
    """
    Returns "High" | "Medium" | "Low" | None (no gap — full score).
    """
    se = s * e
    if se >= 1.0:
        return None   # no gap
    if weight == GAP_HIGH_WEIGHT and se < GAP_HIGH_SE_MAX:
        return "High"
    if weight == GAP_MED_WEIGHT and se < GAP_MED_SE_MAX:
        return "Medium"
    if weight == GAP_HIGH_WEIGHT and GAP_HIGH_SE_MAX <= se < GAP_MED_ALT_SE_MAX:
        return "Medium"
    return "Low"


def build_gaps(
    readiness_result: ReadinessResult,
    job_learning_steps: list[dict],
) -> list[Gap]:
    """
    Build Gap objects from a ReadinessResult.

    job_learning_steps: list of dicts with keys:
        esco_uri, step_type (course/project/certification), title, effort_weeks, step_order
    """
    step_map: dict[str, dict] = {s["esco_uri"]: s for s in job_learning_steps}

    gaps: list[Gap] = []
    for skill in readiness_result.skills:
        severity = classify_severity(skill.weight, skill.s, skill.e)
        if severity is None:
            continue

        step = step_map.get(skill.esco_uri, {
            "step_type": "course",
            "title": f"Learn {skill.esco_label}",
            "effort_weeks": 4,
            "step_order": 99,
        })

        # Determine evidence upgrade for this step type
        upgrades = PROJECTION_UPGRADES.get(step.get("step_type", "course"), (1, 2))
        target_e_level = upgrades[1]

        gaps.append(Gap(
            esco_uri=skill.esco_uri,
            esco_label=skill.esco_label,
            severity=severity,
            weight=skill.weight,
            s=skill.s,
            e=skill.e,
            current_se=round(skill.s * skill.e, 4),
            evidence_level=skill.evidence_level,
            uncalibrated=skill.uncalibrated,
            recommendation={
                "type": step.get("step_type", "course"),
                "title": step.get("title", f"Learn {skill.esco_label}"),
                "effortWeeks": int(step.get("effort_weeks", 4)),
                "targetEvidenceLevel": target_e_level,
                "stepOrder": int(step.get("step_order", 99)),
            },
        ))

    # Sort: High first, then Medium, then Low; within tier by weight desc
    severity_order = {"High": 0, "Medium": 1, "Low": 2}
    gaps.sort(key=lambda g: (severity_order.get(g.severity, 3), -g.weight))
    return gaps


def compute_projected_readiness(
    gaps: list[Gap],
    readiness_result: ReadinessResult,
    required_skills: list[dict],
) -> ProjectedReadiness:
    """
    Recompute Readiness after applying the top 3 learning steps' evidence upgrades.
    Steps are ranked by projected gain / effort_weeks (descending).
    Only steps that map to a required skill contribute.
    """
    # Compute delta for each gap step
    ranked_steps: list[tuple[float, float, Gap]] = []  # (gain_delta, gain_per_week, gap)

    for gap in gaps:
        current_e = EVIDENCE_MULTIPLIER.get(gap.evidence_level, 0.0)
        target_e_level = gap.recommendation["targetEvidenceLevel"]
        target_e = EVIDENCE_MULTIPLIER.get(target_e_level, current_e)

        if target_e <= current_e:
            continue  # no improvement from this step

        # Δ readiness if this step is completed
        delta = 100.0 * gap.s * (target_e - current_e) * gap.weight / readiness_result.total_weight
        effort = max(1, gap.recommendation["effortWeeks"])
        gain_per_week = delta / effort
        ranked_steps.append((delta, gain_per_week, gap))

    # Sort by gain_per_week descending
    ranked_steps.sort(key=lambda x: x[1], reverse=True)
    top_3 = ranked_steps[:3]

    # Apply upgrades to a copy of candidate skills
    candidate_copy = {
        skill.esco_uri: {
            "esco_uri": skill.esco_uri,
            "s": skill.s,
            "evidence_level": skill.evidence_level,
            "uncalibrated": skill.uncalibrated,
        }
        for skill in readiness_result.skills
    }

    any_uncalibrated = readiness_result.uncalibrated
    top_step_records: list[dict] = []

    for delta, gain_per_week, gap in top_3:
        target_e_level = gap.recommendation["targetEvidenceLevel"]
        uri = gap.esco_uri

        if uri in candidate_copy:
            candidate_copy[uri]["evidence_level"] = target_e_level
        else:
            candidate_copy[uri] = {
                "esco_uri": uri,
                "s": gap.s,
                "evidence_level": target_e_level,
                "uncalibrated": gap.uncalibrated,
            }
        if gap.uncalibrated:
            any_uncalibrated = True

        top_step_records.append({
            "stepOrder": gap.recommendation["stepOrder"],
            "escoLabel": gap.esco_label,
            "gainDelta": round(delta, 2),
            "effortWeeks": gap.recommendation["effortWeeks"],
            "gainPerEffortWeek": round(gain_per_week, 3),
        })

    projected = compute_readiness(
        candidate_skills=list(candidate_copy.values()),
        required_skills=required_skills,
    )

    return ProjectedReadiness(
        current_readiness=readiness_result.readiness_index,
        projected_readiness=projected.readiness_index,
        top_steps=top_step_records,
        uncalibrated=any_uncalibrated,
    )
