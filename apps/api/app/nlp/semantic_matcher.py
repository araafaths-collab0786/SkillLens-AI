"""
Semantic skill matcher — apps/api/app/nlp/semantic_matcher.py

Maps a raw skill text to ESCO skills using sentence-transformer cosine similarity.

UNCALIBRATED NOTICE
───────────────────
The cosine→s_i thresholds below are PROPOSED and UNCALIBRATED.
These values must not be changed without Gate 3 written approval and the
held-out evaluation report. Every result from this module carries
uncalibrated=True in the API response.

Threshold table (Section 7):
  cosine ≥ 0.92  → s = 0.95
  0.85 ≤ cosine < 0.92 → s = 0.85
  0.78 ≤ cosine < 0.85 → s = 0.70
  cosine < 0.78  → s = 0.00 (no match)

Stored as named constants — marked UNCALIBRATED.
"""

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# ── UNCALIBRATED threshold constants ─────────────────────────────────────────
# DO NOT CHANGE WITHOUT Gate 3 written approval.
UNCALIBRATED_THRESHOLD_HIGH_COSINE: float = 0.92   # UNCALIBRATED
UNCALIBRATED_THRESHOLD_MED_COSINE:  float = 0.85   # UNCALIBRATED
UNCALIBRATED_THRESHOLD_LOW_COSINE:  float = 0.78   # UNCALIBRATED

UNCALIBRATED_STRENGTH_HIGH: float = 0.95   # UNCALIBRATED
UNCALIBRATED_STRENGTH_MED:  float = 0.85   # UNCALIBRATED
UNCALIBRATED_STRENGTH_LOW:  float = 0.70   # UNCALIBRATED
UNCALIBRATED_STRENGTH_NONE: float = 0.00   # below threshold — no match

MODEL_NAME = "all-MiniLM-L6-v2"


@dataclass
class SemanticMatch:
    esco_uri: str
    esco_label: str
    esco_label_display: str
    cosine_similarity: float
    match_strength: float          # s_i mapped from cosine
    uncalibrated: bool = True      # always True for semantic matches


def _cosine_to_strength(cosine: float) -> float:
    """
    Map cosine similarity to match strength s_i.
    UNCALIBRATED — thresholds from Section 7.
    """
    if cosine >= UNCALIBRATED_THRESHOLD_HIGH_COSINE:
        return UNCALIBRATED_STRENGTH_HIGH
    if cosine >= UNCALIBRATED_THRESHOLD_MED_COSINE:
        return UNCALIBRATED_STRENGTH_MED
    if cosine >= UNCALIBRATED_THRESHOLD_LOW_COSINE:
        return UNCALIBRATED_STRENGTH_LOW
    return UNCALIBRATED_STRENGTH_NONE


@lru_cache(maxsize=1)
def _load_model():
    """Load the sentence-transformer model once per process."""
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(MODEL_NAME)
        logger.info("Sentence transformer model loaded: %s", MODEL_NAME)
        return model
    except ImportError:
        logger.warning("sentence-transformers not installed. Semantic matching disabled.")
        return None
    except Exception as e:
        logger.warning("Failed to load model %s: %s. Semantic matching disabled.", MODEL_NAME, e)
        return None


@lru_cache(maxsize=1)
def _get_esco_embeddings() -> tuple[list[str], list[str], "list"] | None:
    """
    Precompute embeddings for all ESCO skill labels.
    Returns (uris, labels, embeddings_tensor) or None if model unavailable.
    """
    from app.nlp.esco_loader import load_esco_index
    model = _load_model()
    if model is None:
        return None

    index = load_esco_index()
    uris = [s.uri for s in index.skills]
    labels = [s.label_display for s in index.skills]
    labels_lower = [s.label for s in index.skills]

    try:
        embeddings = model.encode(labels_lower, convert_to_tensor=True, show_progress_bar=False)
        logger.info("ESCO embeddings precomputed for %d skills", len(labels))
        return uris, labels, embeddings
    except Exception as e:
        logger.warning("Failed to precompute ESCO embeddings: %s", e)
        return None


def semantic_match(
    text: str,
    top_k: int = 1,
) -> list[SemanticMatch]:
    """
    Find the best ESCO skill matches for a raw text string using cosine similarity.
    Returns a list of SemanticMatch (may be empty if model unavailable or below threshold).
    All results carry uncalibrated=True.
    """
    precomputed = _get_esco_embeddings()
    if precomputed is None:
        return []

    uris, labels, esco_embeddings = precomputed
    model = _load_model()
    if model is None:
        return []

    try:
        import torch
        query_embedding = model.encode(text.lower(), convert_to_tensor=True, show_progress_bar=False)
        cosine_scores = torch.nn.functional.cosine_similarity(
            query_embedding.unsqueeze(0), esco_embeddings
        )
        top_results = torch.topk(cosine_scores, min(top_k, len(uris)))

        matches = []
        for score, idx in zip(top_results.values.tolist(), top_results.indices.tolist()):
            strength = _cosine_to_strength(score)
            if strength > 0:
                matches.append(SemanticMatch(
                    esco_uri=uris[idx],
                    esco_label=labels[idx].lower(),
                    esco_label_display=labels[idx],
                    cosine_similarity=round(float(score), 4),
                    match_strength=strength,
                    uncalibrated=True,
                ))
        return matches
    except Exception as e:
        logger.warning("Semantic match failed for '%s': %s", text, e)
        return []
