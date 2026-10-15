"""
Step 4 — enhance.py

Enhancement pipeline:
- CLAHE (contrast limited adaptive histogram equalization)
- Gaussian denoising
- Deskew via minAreaRect
"""

import cv2
import numpy as np
from PIL import Image

from app.verification import StepResult

CLAHE_CLIP = 2.0
CLAHE_GRID = (8, 8)
DESKEW_MAX_ANGLE = 15.0  # only correct if angle is within ±15°


def enhance(img: Image.Image) -> tuple[StepResult, Image.Image]:
    """
    Apply CLAHE + denoising + deskew to a PIL image.
    Returns (StepResult, enhanced_image).
    """
    flags: list[str] = []
    metrics: dict = {}

    bgr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # 1. CLAHE
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP, tileGridSize=CLAHE_GRID)
    enhanced = clahe.apply(gray)

    # 2. Denoising
    enhanced = cv2.fastNlMeansDenoising(enhanced, h=10)

    # 3. Deskew
    angle = _estimate_skew(enhanced)
    metrics["skew_angle_deg"] = round(angle, 2)
    if abs(angle) > 0.5 and abs(angle) <= DESKEW_MAX_ANGLE:
        enhanced = _rotate(enhanced, angle)
        flags.append(f"Deskewed by {angle:.1f}°.")
    elif abs(angle) > DESKEW_MAX_ANGLE:
        flags.append(
            f"Skew angle {angle:.1f}° exceeds threshold ({DESKEW_MAX_ANGLE}°). "
            "Manual correction may be needed."
        )

    pil_out = Image.fromarray(enhanced)
    return StepResult(
        step="enhance", status="passed", flags=flags, metrics=metrics
    ), pil_out


def _estimate_skew(gray: np.ndarray) -> float:
    """Estimate skew angle using minAreaRect on detected text contours."""
    try:
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return 0.0
        # Use the largest contour
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) < 100:
            return 0.0
        rect = cv2.minAreaRect(largest)
        angle = rect[2]
        # Normalize to [-45, 45]
        if angle < -45:
            angle += 90
        return angle
    except Exception:
        return 0.0


def _rotate(img: np.ndarray, angle: float) -> np.ndarray:
    h, w = img.shape[:2]
    cx, cy = w // 2, h // 2
    M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
