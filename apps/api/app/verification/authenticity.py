"""
Step 5 — authenticity.py

Quality and authenticity-RISK screening. This module checks for signals that
warrant human review. It does NOT verify authenticity — it never outputs
"genuine" or "fake."

Checks:
  A. Possible screen capture (moiré pattern via FFT peak analysis)
  B. Possible duplicate submission (perceptual hash vs. user's prior uploads)
  C. Inconsistent metadata / unusual compression artifacts

All outputs are risk flags with "needs_human_review" status where relevant.
"""

import hashlib
import numpy as np
from PIL import Image

from app.verification import StepResult

# imagehash is optional — graceful degradation if not installed
try:
    import imagehash
    _IMAGEHASH_AVAILABLE = True
except ImportError:
    _IMAGEHASH_AVAILABLE = False


def screen_authenticity_risk(
    img: Image.Image,
    prior_hashes: list[str] | None = None,
) -> tuple[StepResult, str]:
    """
    Run authenticity-risk checks.

    Args:
        img: PIL image to check.
        prior_hashes: List of perceptual hash strings from the user's prior uploads.

    Returns:
        (StepResult, perceptual_hash_string)

    DISCLAIMER: This screening checks document quality and consistency.
    It does not confirm that the document or its claims are genuine.
    """
    flags: list[str] = []
    metrics: dict = {}

    # A. Moiré / screen-capture detection via FFT
    moire_detected = _check_moire(img, metrics)
    if moire_detected:
        flags.append(
            "Possible screen capture detected (moiré pattern via FFT). "
            "This is a risk indicator for human review — it does not confirm the document is inauthentic."
        )

    # B. Duplicate detection
    phash_str = ""
    if _IMAGEHASH_AVAILABLE:
        try:
            phash = imagehash.phash(img)
            phash_str = str(phash)
            metrics["perceptual_hash"] = phash_str
            if prior_hashes:
                for prior in prior_hashes:
                    try:
                        dist = phash - imagehash.hex_to_hash(prior)
                        if dist <= 8:  # threshold for near-duplicate
                            flags.append(
                                f"Possible duplicate submission detected "
                                f"(perceptual hash distance: {dist}). "
                                "This is an informational flag — review if unexpected."
                            )
                            metrics["duplicate_hash_distance"] = dist
                            break
                    except Exception:
                        pass
        except Exception:
            metrics["perceptual_hash"] = "error"
    else:
        # Fallback: MD5 of raw bytes for exact-duplicate detection only
        raw = img.tobytes()
        phash_str = hashlib.md5(raw).hexdigest()
        metrics["perceptual_hash"] = phash_str
        metrics["hash_method"] = "md5_fallback"

    # C. Compression artifact check (JPEG-like blockiness)
    blockiness = _check_blockiness(img, metrics)
    if blockiness:
        flags.append(
            "Unusual compression artifacts detected. "
            "This may indicate the image was heavily re-compressed — risk flag for review."
        )

    status = "warning" if flags else "passed"
    return StepResult(
        step="authenticity_risk",
        status=status,
        flags=flags,
        metrics=metrics,
    ), phash_str


def _check_moire(img: Image.Image, metrics: dict) -> bool:
    """
    Detect moiré patterns using FFT peak analysis.
    Returns True if a suspicious frequency peak is found.
    """
    try:
        gray = np.array(img.convert("L"), dtype=np.float32)
        f = np.fft.fft2(gray)
        fshift = np.fft.fftshift(f)
        magnitude = np.abs(fshift)

        # Normalize and find peak outside the DC component (center)
        h, w = magnitude.shape
        cy, cx = h // 2, w // 2
        # Zero out the central DC region (20% of image dimensions)
        mask = np.ones_like(magnitude)
        r = min(h, w) // 10
        mask[cy - r : cy + r, cx - r : cx + r] = 0
        masked = magnitude * mask

        peak = float(np.max(masked))
        mean = float(np.mean(masked[masked > 0])) if np.any(masked > 0) else 1.0
        peak_ratio = peak / mean if mean > 0 else 0.0
        metrics["fft_peak_ratio"] = round(peak_ratio, 2)

        # Threshold: a very sharp FFT peak relative to background suggests
        # a periodic pattern (moiré from photographing a screen)
        return peak_ratio > 50.0
    except Exception:
        return False


def _check_blockiness(img: Image.Image, metrics: dict) -> bool:
    """
    Estimate JPEG blockiness by comparing 8×8 block boundaries.
    High variance at block edges suggests heavy compression.
    """
    try:
        gray = np.array(img.convert("L"), dtype=np.float32)
        h, w = gray.shape

        # Horizontal block edges
        h_edges = []
        for row in range(8, h - 8, 8):
            diff = np.abs(gray[row, :] - gray[row - 1, :])
            h_edges.append(float(np.mean(diff)))

        # Vertical block edges
        v_edges = []
        for col in range(8, w - 8, 8):
            diff = np.abs(gray[:, col] - gray[:, col - 1])
            v_edges.append(float(np.mean(diff)))

        if not h_edges or not v_edges:
            return False

        block_score = (np.mean(h_edges) + np.mean(v_edges)) / 2
        metrics["blockiness_score"] = round(float(block_score), 3)

        # Compare to non-edge mean
        non_edge_diff = float(np.mean(np.abs(np.diff(gray, axis=0))))
        ratio = block_score / non_edge_diff if non_edge_diff > 0 else 0
        metrics["blockiness_ratio"] = round(ratio, 3)
        return ratio > 3.0  # block edges much sharper than average
    except Exception:
        return False
