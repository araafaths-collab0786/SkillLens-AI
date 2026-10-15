"""
Step 1 — quality_check.py

Checks: blur (variance of Laplacian), brightness, resolution.
- Warns below soft thresholds.
- Fails only for unreadable or unsupported images.
"""

import numpy as np
from PIL import Image

from app.verification import StepResult

# ── Thresholds (warn, not reject) ────────────────────────────────────────────
BLUR_WARN = 80.0       # variance of Laplacian below this → warn
BRIGHTNESS_LOW = 40    # mean pixel value below this → too dark
BRIGHTNESS_HIGH = 220  # mean pixel value above this → too bright / washed out
MIN_WIDTH = 400        # pixels
MIN_HEIGHT = 500       # pixels


def check_quality(img: Image.Image) -> StepResult:
    """
    Run quality checks on a PIL image.
    Returns StepResult with status passed/warning/failed.
    """
    flags: list[str] = []
    metrics: dict = {}

    try:
        # Convert to numpy for OpenCV-style checks (no cv2 needed at this step)
        arr = np.array(img.convert("L"), dtype=np.float32)  # grayscale
    except Exception as e:
        return StepResult(
            step="quality_check",
            status="failed",
            flags=[f"Could not read image: {e}"],
            metrics={},
        )

    # Resolution check
    w, h = img.size
    metrics["width_px"] = w
    metrics["height_px"] = h
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        flags.append(
            f"Low resolution: {w}×{h} px. Minimum recommended: {MIN_WIDTH}×{MIN_HEIGHT} px."
        )

    # Blur check — variance of Laplacian (numpy-only implementation)
    try:
        # Simple finite-difference Laplacian approximation without scipy
        lap = (
            np.roll(arr, 1, axis=0) + np.roll(arr, -1, axis=0) +
            np.roll(arr, 1, axis=1) + np.roll(arr, -1, axis=1) -
            4 * arr
        )
        blur_score = float(np.var(lap))
    except Exception:
        blur_score = None

    if blur_score is not None:
        metrics["blur_variance"] = round(blur_score, 2)
        if blur_score < BLUR_WARN:
            flags.append(
                f"Image may be blurry (Laplacian variance: {blur_score:.1f}, "
                f"threshold: {BLUR_WARN}). Hold the camera steady and retry."
            )

    # Brightness check
    mean_brightness = float(np.mean(arr))
    metrics["mean_brightness"] = round(mean_brightness, 1)
    if mean_brightness < BRIGHTNESS_LOW:
        flags.append(
            f"Image is too dark (mean brightness: {mean_brightness:.0f}/255). "
            "Improve lighting and retry."
        )
    elif mean_brightness > BRIGHTNESS_HIGH:
        flags.append(
            f"Image is overexposed (mean brightness: {mean_brightness:.0f}/255). "
            "Reduce glare and retry."
        )

    status: str = "warning" if flags else "passed"
    return StepResult(step="quality_check", status=status, flags=flags, metrics=metrics)
