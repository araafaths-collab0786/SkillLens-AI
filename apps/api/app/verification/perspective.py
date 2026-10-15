"""
Step 3 — perspective.py

Applies getPerspectiveTransform + warpPerspective to produce a top-down view.
Uses confirmed crop corners from the user (or auto-detected corners).
Falls back to the full frame if corners are unusable.
"""

import cv2
import numpy as np
from PIL import Image

from app.verification import StepResult

# Target output size for the corrected document
OUTPUT_WIDTH = 800
OUTPUT_HEIGHT = 1100


def correct_perspective(
    img: Image.Image,
    corners: list[list[int]] | None,
) -> tuple[StepResult, Image.Image]:
    """
    Warp the image to a top-down rectangle.

    Args:
        img: Input PIL image.
        corners: [[x,y]×4] in order [topLeft, topRight, bottomRight, bottomLeft],
                 or None to use the full frame.

    Returns:
        (StepResult, corrected_image)
    """
    flags: list[str] = []
    metrics: dict = {}

    bgr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)

    if corners is None:
        flags.append("No corners provided — using full frame (perspective correction skipped).")
        metrics["method"] = "fallback_no_corners"
        pil_out = img.copy()
        return StepResult(
            step="perspective", status="warning", flags=flags, metrics=metrics
        ), pil_out

    try:
        src = np.array(corners, dtype=np.float32)
        dst = np.array(
            [[0, 0], [OUTPUT_WIDTH, 0], [OUTPUT_WIDTH, OUTPUT_HEIGHT], [0, OUTPUT_HEIGHT]],
            dtype=np.float32,
        )
        M = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(bgr, M, (OUTPUT_WIDTH, OUTPUT_HEIGHT))
        pil_out = Image.fromarray(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))
        metrics["method"] = "perspective_warp"
        metrics["output_size"] = [OUTPUT_WIDTH, OUTPUT_HEIGHT]
        status = "passed"
    except Exception as e:
        flags.append(f"Perspective correction failed ({e}). Using full frame.")
        metrics["method"] = "fallback_error"
        pil_out = img.copy()
        status = "warning"

    return StepResult(step="perspective", status=status, flags=flags, metrics=metrics), pil_out
