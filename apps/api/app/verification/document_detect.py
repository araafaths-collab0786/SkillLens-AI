"""
Step 2 — document_detect.py

Uses OpenCV to detect the largest 4-point document contour in an image.
Returns the corner points (or None if no clear document is found).
"""

import cv2
import numpy as np
from PIL import Image

from app.verification import StepResult


def _pil_to_bgr(img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)


def detect_document(img: Image.Image) -> tuple[StepResult, list[list[int]] | None]:
    """
    Detect the largest 4-point contour in the image.

    Returns:
        (StepResult, corners)
        corners: list of 4 [x, y] points [topLeft, topRight, bottomRight, bottomLeft]
                 or None if detection failed.
    """
    flags: list[str] = []
    metrics: dict = {}

    bgr = _pil_to_bgr(img)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    # Dilate to close gaps
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        flags.append("No document contour detected. Using full frame as fallback.")
        metrics["detection_method"] = "fallback_full_frame"
        return StepResult(step="document_detect", status="warning", flags=flags, metrics=metrics), None

    # Sort by area descending
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    corners = None

    for contour in contours[:5]:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            img_area = img.size[0] * img.size[1]
            coverage = area / img_area
            metrics["contour_coverage"] = round(coverage, 3)
            if coverage > 0.05:  # at least 5% of image
                corners = approx.reshape(4, 2).tolist()
                corners = _order_corners(corners)
                metrics["detection_method"] = "contour"
                break

    if corners is None:
        flags.append("Could not find a clear 4-point document outline. Using full frame.")
        metrics["detection_method"] = "fallback_full_frame"
        status = "warning"
    else:
        status = "passed"

    return StepResult(step="document_detect", status=status, flags=flags, metrics=metrics), corners


def _order_corners(pts: list) -> list[list[int]]:
    """Order corners as [topLeft, topRight, bottomRight, bottomLeft]."""
    pts = np.array(pts, dtype=np.float32)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)
    tl = pts[np.argmin(s)].tolist()
    br = pts[np.argmax(s)].tolist()
    tr = pts[np.argmin(diff)].tolist()
    bl = pts[np.argmax(diff)].tolist()
    return [[int(p) for p in c] for c in [tl, tr, br, bl]]
