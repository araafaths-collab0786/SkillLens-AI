"""
ESCO skill relations — apps/api/app/scoring/esco_relations.py

Maps each ESCO skill URI to its related / transferable skills.
These are one-hop ESCO "related skill" relations (broader, narrower, or lateral).

IMPORTANT: These relations are a seed-level approximation of the ESCO graph.
They are used only for the transferable-skills panel — they do NOT count toward
the Readiness Index or any score (Section 7).

Full ESCO graph support (CSV-loaded) can replace this map in Phase 7.
"""

from __future__ import annotations

# Each key maps to a list of {esco_uri, label} dicts that are
# "related" or "transferable" skills via ESCO relations.
ESCO_RELATED_SKILLS: dict[str, list[dict]] = {
    "esco:python": [
        {"esco_uri": "esco:ml",       "label": "machine learning"},
        {"esco_uri": "esco:data_analysis", "label": "data analysis"},
        {"esco_uri": "esco:fastapi",  "label": "FastAPI"},
    ],
    "esco:javascript": [
        {"esco_uri": "esco:typescript", "label": "TypeScript"},
        {"esco_uri": "esco:react",    "label": "React"},
    ],
    "esco:typescript": [
        {"esco_uri": "esco:javascript", "label": "JavaScript"},
        {"esco_uri": "esco:react",    "label": "React"},
    ],
    "esco:react": [
        {"esco_uri": "esco:javascript", "label": "JavaScript"},
        {"esco_uri": "esco:typescript", "label": "TypeScript"},
    ],
    "esco:sql": [
        {"esco_uri": "esco:data_analysis", "label": "data analysis"},
    ],
    "esco:ml": [
        {"esco_uri": "esco:python",   "label": "Python"},
        {"esco_uri": "esco:dl",       "label": "deep learning"},
        {"esco_uri": "esco:data_analysis", "label": "data analysis"},
    ],
    "esco:dl": [
        {"esco_uri": "esco:ml",       "label": "machine learning"},
        {"esco_uri": "esco:pytorch",  "label": "PyTorch"},
        {"esco_uri": "esco:tensorflow", "label": "TensorFlow"},
    ],
    "esco:nlp": [
        {"esco_uri": "esco:dl",       "label": "deep learning"},
        {"esco_uri": "esco:ml",       "label": "machine learning"},
        {"esco_uri": "esco:python",   "label": "Python"},
    ],
    "esco:cv": [
        {"esco_uri": "esco:dl",       "label": "deep learning"},
        {"esco_uri": "esco:python",   "label": "Python"},
    ],
    "esco:docker": [
        {"esco_uri": "esco:kubernetes", "label": "Kubernetes"},
    ],
    "esco:kubernetes": [
        {"esco_uri": "esco:docker",   "label": "Docker"},
    ],
    "esco:aws": [
        {"esco_uri": "esco:docker",   "label": "Docker"},
        {"esco_uri": "esco:kubernetes", "label": "Kubernetes"},
    ],
    "esco:fastapi": [
        {"esco_uri": "esco:python",   "label": "Python"},
    ],
    "esco:data_analysis": [
        {"esco_uri": "esco:sql",      "label": "SQL"},
        {"esco_uri": "esco:python",   "label": "Python"},
    ],
    "esco:project_mgmt": [
        {"esco_uri": "esco:teamwork", "label": "teamwork"},
        {"esco_uri": "esco:communication", "label": "communication"},
    ],
    "esco:problem_solving": [
        {"esco_uri": "esco:communication", "label": "communication"},
    ],
    "esco:communication": [
        {"esco_uri": "esco:teamwork", "label": "teamwork"},
    ],
    "esco:teamwork": [
        {"esco_uri": "esco:communication", "label": "communication"},
        {"esco_uri": "esco:project_mgmt", "label": "project management"},
    ],
}


def get_related_skills(
    esco_uri: str,
    candidate_uris: set[str],
) -> list[dict]:
    """
    Return related ESCO skills that the candidate already has.

    Args:
        esco_uri: The required skill URI with a gap.
        candidate_uris: Set of skill URIs the candidate possesses.

    Returns:
        List of {escoId, label} dicts — only candidate-possessed skills.
    """
    related = ESCO_RELATED_SKILLS.get(esco_uri, [])
    return [
        {"escoId": r["esco_uri"], "label": r["label"]}
        for r in related
        if r["esco_uri"] in candidate_uris
    ]
