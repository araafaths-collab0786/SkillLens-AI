"""
Calibration harness — apps/api/app/scoring/calibration.py

GATE 3 NOTICE
─────────────
This harness may ONLY be run after Gate 3 written approval:
  1. The validation dataset composition (≥ 100 pairs) must be approved.
  2. The label definition and labeling guide must be approved.
  3. Thresholds must NOT be changed based on this output without a second
     written approval after the held-out evaluation is reported.

Until Gate 3 is approved:
  - No calibration run will be initiated.
  - All semantic matches remain labeled "uncalibrated".
  - This file defines the harness and the dataset spec ONLY.

DATASET SPECIFICATION (for Gate 3 approval)
────────────────────────────────────────────
Presented for approval below. Do not label pairs until approved.

Minimum size: 100 candidate–skill pairs.

Composition (proportions to ensure coverage):
  - 40 pairs from IT / software roles (JavaScript, Python, ML, DevOps)
  - 20 pairs from data analytics roles (SQL, data analysis, ML)
  - 20 pairs from soft-skills roles (communication, teamwork, problem solving)
  - 10 pairs from healthcare / logistics / skilled trades
  - 10 pairs from edge cases: abbreviations (k8s, ML, NLP), synonyms
    (nodejs/node.js), near-misses (Ruby vs Python), and out-of-scope text
    that should produce no match.

Label definition:
  A pair (raw_text, esco_uri) is labeled MATCH (1) if a domain expert
  would agree that the raw_text refers to the same skill or a specific
  sub-skill of the ESCO concept identified by esco_uri. It is labeled
  NO_MATCH (0) otherwise.
  Examples of MATCH: "ML" → esco:ml, "k8s" → esco:kubernetes
  Examples of NO_MATCH: "Ruby" → esco:python, "management" → esco:ml

Labeling guide:
  1. Two independent labelers label all pairs.
  2. Disagreements are resolved by a third reviewer.
  3. Inter-annotator agreement (Cohen's κ) must be ≥ 0.80 before use.
  4. The approved set is split: 80 pairs tuning, 20 pairs held-out test.
     The split is done BEFORE any threshold is adjusted.
  5. Precision, recall, F1, and the confusion matrix are reported for each
     threshold setting on the HELD-OUT split only.
  6. Accuracy on real, unseen resumes is unknown. The README must say so.

File path: data/validation/pairs.csv
Columns: pair_id, raw_text, esco_uri, label (1/0), labeler_1, labeler_2,
         resolved_label, notes

AWAITING GATE 3 APPROVAL BEFORE ANY PAIRS ARE LABELED.
"""

import csv
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[4]
_PAIRS_CSV = _REPO_ROOT / "data" / "validation" / "pairs.csv"

GATE_3_APPROVED = False   # Set to True ONLY after written Gate 3 approval


@dataclass
class ValidationPair:
    pair_id: str
    raw_text: str
    esco_uri: str
    label: int              # 1 = MATCH, 0 = NO_MATCH
    resolved: bool = True   # True = final label agreed


@dataclass
class CalibrationReport:
    total_pairs: int
    split: str              # "tuning" | "held_out"
    threshold_tested: float
    precision: float
    recall: float
    f1: float
    true_positive: int
    false_positive: int
    true_negative: int
    false_negative: int
    uncalibrated_notice: str = (
        "UNCALIBRATED — thresholds not yet approved. "
        "Do not present scores as measured accuracy."
    )


def load_validation_pairs(split: str = "all") -> list[ValidationPair]:
    """
    Load labeled validation pairs from data/validation/pairs.csv.
    split: "all" | "tuning" | "held_out"
    GATE 3 MUST BE APPROVED before calling this.
    """
    if not GATE_3_APPROVED:
        raise RuntimeError(
            "Gate 3 has not been approved. "
            "The calibration harness cannot run until the validation dataset "
            "composition and labeling guide are approved in writing."
        )
    if not _PAIRS_CSV.exists():
        raise FileNotFoundError(
            f"Validation pairs CSV not found: {_PAIRS_CSV}. "
            "Label pairs after Gate 3 approval and place them at this path."
        )
    pairs = []
    with open(_PAIRS_CSV, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if split != "all" and row.get("split", "tuning") != split:
                continue
            pairs.append(ValidationPair(
                pair_id=row["pair_id"],
                raw_text=row["raw_text"],
                esco_uri=row["esco_uri"],
                label=int(row["resolved_label"]),
                resolved=True,
            ))
    return pairs


def run_calibration(cosine_thresholds: Optional[list[float]] = None) -> list[CalibrationReport]:
    """
    Run the calibration sweep over cosine thresholds.
    Reports metrics on the held-out split ONLY.
    GATE 3 MUST BE APPROVED before calling this.
    DO NOT CHANGE THRESHOLDS based on this output without a second written approval.
    """
    if not GATE_3_APPROVED:
        raise RuntimeError(
            "Gate 3 has not been approved. Calibration blocked."
        )

    from app.nlp.semantic_matcher import _load_model, _get_esco_embeddings
    import torch  # type: ignore[import-untyped]

    pairs = load_validation_pairs(split="held_out")
    if len(pairs) < 20:
        raise ValueError(
            f"Held-out split has only {len(pairs)} pairs (minimum 20 required). "
            "Check the dataset."
        )

    model = _load_model()
    if model is None:
        raise RuntimeError("Sentence transformer model not available for calibration.")

    if cosine_thresholds is None:
        # Default sweep (0.70 to 0.95 in steps of 0.01)
        cosine_thresholds = [round(0.70 + i * 0.01, 2) for i in range(26)]

    precomputed = _get_esco_embeddings()
    if precomputed is None:
        raise RuntimeError("Could not precompute ESCO embeddings.")
    uris, labels, esco_embeddings = precomputed

    reports = []
    for threshold in cosine_thresholds:
        tp = fp = tn = fn = 0
        for pair in pairs:
            query_emb = model.encode(pair.raw_text.lower(), convert_to_tensor=True, show_progress_bar=False)
            sims = torch.nn.functional.cosine_similarity(query_emb.unsqueeze(0), esco_embeddings)
            best_sim = float(sims.max().item())
            best_uri_idx = int(sims.argmax().item())
            best_uri = uris[best_uri_idx]

            predicted = 1 if (best_sim >= threshold and best_uri == pair.esco_uri) else 0
            if predicted == 1 and pair.label == 1:
                tp += 1
            elif predicted == 1 and pair.label == 0:
                fp += 1
            elif predicted == 0 and pair.label == 0:
                tn += 1
            else:
                fn += 1

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec  = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1   = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0

        reports.append(CalibrationReport(
            total_pairs=len(pairs),
            split="held_out",
            threshold_tested=threshold,
            precision=round(prec, 4),
            recall=round(rec, 4),
            f1=round(f1, 4),
            true_positive=tp,
            false_positive=fp,
            true_negative=tn,
            false_negative=fn,
        ))

    logger.info(
        "Calibration report generated for %d thresholds on %d held-out pairs. "
        "UNCALIBRATED — do not change thresholds without written approval.",
        len(reports), len(pairs)
    )
    return reports
