"""
Scoring constants and evidence helpers — apps/api/app/scoring/constants.py

All UNCALIBRATED semantic thresholds are stored here as named constants.
DO NOT CHANGE without Gate 3 written approval and the held-out evaluation report.
"""

# ── Evidence multipliers ──────────────────────────────────────────────────────
EVIDENCE_MULTIPLIER: dict[int, float] = {
    3: 1.0,    # Verified
    2: 0.85,   # Demonstrated
    1: 0.6,    # Claimed
    0: 0.0,    # Absent
}

# ── Job weights ───────────────────────────────────────────────────────────────
VALID_WEIGHTS: set[int] = {1, 2, 3}

# ── UNCALIBRATED semantic thresholds ─────────────────────────────────────────
# Source: Section 7. Proposed values — not calibrated against real data.
# Gate 3 approval required before changing any value.
UNCALIBRATED_COSINE_HIGH:    float = 0.92  # UNCALIBRATED
UNCALIBRATED_COSINE_MED:     float = 0.85  # UNCALIBRATED
UNCALIBRATED_COSINE_LOW:     float = 0.78  # UNCALIBRATED
UNCALIBRATED_STRENGTH_HIGH:  float = 0.95  # UNCALIBRATED
UNCALIBRATED_STRENGTH_MED:   float = 0.85  # UNCALIBRATED
UNCALIBRATED_STRENGTH_LOW:   float = 0.70  # UNCALIBRATED
UNCALIBRATED_STRENGTH_NONE:  float = 0.00  # UNCALIBRATED

# ── Gap severity thresholds ───────────────────────────────────────────────────
# High: weight=3 AND s_i * e_i < 0.5
# Medium: (weight=2 AND s*e < 0.5) OR (weight=3 AND 0.5 ≤ s*e < 0.85)
# Low: any remaining gap where s*e < 1.0
GAP_HIGH_WEIGHT    = 3
GAP_HIGH_SE_MAX    = 0.5
GAP_MED_WEIGHT     = 2
GAP_MED_SE_MAX     = 0.5
GAP_MED_ALT_SE_MAX = 0.85

# ── Projection evidence upgrade rules ────────────────────────────────────────
# Maps step type → (from_evidence_level, to_evidence_level)
PROJECTION_UPGRADES: dict[str, tuple[int, int]] = {
    "course":          (1, 2),   # Claimed → Demonstrated (cert upload)
    "course_verified": (1, 3),   # Claimed → Verified (cert ID validates)
    "project":         (2, 3),   # Demonstrated → Verified (public repo)
    "certification":   (1, 3),   # Any → Verified
}
