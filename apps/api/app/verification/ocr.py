"""
Step 6 — ocr.py

Runs pytesseract OCR on an enhanced image.
Returns extracted text with per-word confidence scores.
Low-confidence regions are flagged.
"""

import pytesseract
from PIL import Image

from app.verification import StepResult

# Confidence below this threshold triggers a flag
LOW_CONFIDENCE_THRESHOLD = 50  # out of 100


def run_ocr(img: Image.Image) -> tuple[StepResult, str]:
    """
    Run pytesseract on the image.

    Returns:
        (StepResult, extracted_text)
    """
    flags: list[str] = []
    metrics: dict = {}

    try:
        # Get per-word confidence data
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    except Exception as e:
        return StepResult(
            step="ocr",
            status="failed",
            flags=[f"OCR engine error: {e}"],
            metrics={},
        ), ""

    words = []
    confidences = []
    low_conf_count = 0

    for i, text in enumerate(data["text"]):
        text = str(text).strip()
        if not text:
            continue
        conf = int(data["conf"][i])
        if conf < 0:
            continue  # tesseract uses -1 for non-text
        words.append(text)
        confidences.append(conf)
        if conf < LOW_CONFIDENCE_THRESHOLD:
            low_conf_count += 1

    total_words = len(words)
    metrics["total_words"] = total_words
    metrics["low_confidence_words"] = low_conf_count

    if total_words == 0:
        return StepResult(
            step="ocr",
            status="failed",
            flags=["No text extracted. The image may be blank or unreadable."],
            metrics=metrics,
        ), ""

    low_conf_ratio = low_conf_count / total_words
    metrics["low_confidence_ratio"] = round(low_conf_ratio, 3)

    if low_conf_ratio > 0.3:
        flags.append(
            f"{low_conf_count}/{total_words} words had low OCR confidence (<{LOW_CONFIDENCE_THRESHOLD}%). "
            "Image quality may be affecting text extraction accuracy."
        )

    if confidences:
        metrics["mean_confidence"] = round(sum(confidences) / len(confidences), 1)

    extracted_text = " ".join(words)
    status = "warning" if flags else "passed"

    return StepResult(
        step="ocr",
        status=status,
        flags=flags,
        metrics=metrics,
    ), extracted_text
