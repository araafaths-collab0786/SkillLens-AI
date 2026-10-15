"""
Resume intake router.

POST /api/v1/resumes
  intake_method = "pdf_upload"    — multipart upload
  intake_method = "camera_capture" — base64 image + crop corners

Both require a client-generated submission_id (UUID) for idempotency.
The server ignores duplicate submission_ids (returns the existing record).

GET  /api/v1/resumes/{id}
DELETE /api/v1/resumes/{id}
POST /api/v1/resumes/{id}/detect-document  (camera method — live hints)
"""

import base64
import io
import os
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from PIL import Image
from pymongo.asynchronous.database import AsyncDatabase

from app.auth.dependencies import get_current_user_id
from app.auth.rate_limit import upload_limiter
from app.config import settings
from app.db.connection import get_db
from app.models.envelope import err, ok
from app.verification.authenticity import screen_authenticity_risk
from app.verification.document_detect import detect_document
from app.verification.enhance import enhance
from app.verification.ocr import run_ocr
from app.verification.perspective import correct_perspective
from app.verification.quality_check import check_quality
from app.verification.upload_validation import strip_exif, validate_upload

router = APIRouter(prefix="/api/v1/resumes", tags=["resumes"])

RESUME_DISCLAIMER = (
    "This screening checks document quality and consistency. "
    "It does not confirm that the document or its claims are genuine."
)


def _get_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


async def _run_pipeline_image(
    img: Image.Image,
    intake_method: str,
    corners: list | None,
    prior_hashes: list[str],
) -> tuple[list[dict], str, str]:
    """
    Run the full screening pipeline on an image.
    Returns (step_results, extracted_text, perceptual_hash).
    """
    step_results = []

    # Step 1: Quality check
    r1 = check_quality(img)
    step_results.append(r1.to_dict())

    # Steps 2-4 only for camera_capture
    working_img = img
    if intake_method == "camera_capture":
        # Step 2: Document detection
        r2, detected_corners = detect_document(img)
        step_results.append(r2.to_dict())
        final_corners = corners if corners else detected_corners

        # Step 3: Perspective correction
        r3, working_img = correct_perspective(img, final_corners)
        step_results.append(r3.to_dict())

        # Step 4: Enhancement
        r4, working_img = enhance(working_img)
        step_results.append(r4.to_dict())

    # Step 5: Authenticity risk
    r5, phash = screen_authenticity_risk(working_img, prior_hashes)
    step_results.append(r5.to_dict())

    # Step 6: OCR
    r6, text = run_ocr(working_img)
    step_results.append(r6.to_dict())

    return step_results, text, phash


# ── POST /api/v1/resumes ──────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_resume(
    request: Request,
    db: AsyncDatabase = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    content_type = request.headers.get("content-type", "")

    # ── Method A: multipart PDF/image upload ──────────────────────────────
    if "multipart/form-data" in content_type:
        form = await request.form()
        file: UploadFile = form.get("file")
        submission_id = str(form.get("submission_id", ""))
        if not file:
            return err("MISSING_FILE", "No file provided.")
    else:
        # ── Method B: JSON camera capture ─────────────────────────────────
        body = await request.json()
        submission_id = body.get("submission_id", "")
        image_b64 = body.get("imageBase64", "")
        crop_corners = body.get("cropCorners", None)
        if not image_b64:
            return err("MISSING_IMAGE", "No image data provided.")

    # Validate submission_id
    try:
        uuid.UUID(submission_id)
    except (ValueError, AttributeError):
        return err("INVALID_SUBMISSION_ID", "submission_id must be a valid UUID.")

    # Idempotency check
    existing = await db["resumes"].find_one({"submissionId": submission_id, "userId": user_id})
    if existing:
        return ok(_format_resume(existing))

    # Rate limit
    ip = _get_ip(request)
    if not upload_limiter.is_allowed(f"upload:{user_id}") or not upload_limiter.is_allowed(f"ip:{ip}"):
        raise HTTPException(status_code=429, detail="Upload rate limit exceeded. Try again later.")

    # ── Read file bytes ───────────────────────────────────────────────────
    if "multipart/form-data" in content_type:
        intake_method = "pdf_upload"
        raw_bytes = await file.read()
        corners = None
    else:
        intake_method = "camera_capture"
        try:
            raw_bytes = base64.b64decode(image_b64)
        except Exception:
            return err("INVALID_IMAGE", "imageBase64 is not valid base64.")
        corners = crop_corners

    # ── Server-side validation ────────────────────────────────────────────
    result = validate_upload(raw_bytes)
    if not result.valid:
        return err("VALIDATION_FAILED", result.error or "File validation failed.")

    file_type = result.file_type
    resume_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc)

    # ── Run pipeline with timeout ─────────────────────────────────────────
    try:
        deadline = time.time() + settings.upload_processing_timeout_seconds

        if file_type == "pdf":
            # Rasterize first page of PDF
            img = _pdf_to_image(raw_bytes)
            if img is None:
                return err("PDF_RASTERIZE_FAILED", "Could not rasterize PDF page.")
            # PDF path: steps 1, 5, 6 only
            step_results, extracted_text, phash = await _run_pipeline_image(
                img, "pdf_upload", None, await _get_prior_hashes(db, user_id)
            )
        else:
            # Image path
            clean_bytes = strip_exif(raw_bytes, file_type)
            img = Image.open(io.BytesIO(clean_bytes))
            step_results, extracted_text, phash = await _run_pipeline_image(
                img, intake_method, corners, await _get_prior_hashes(db, user_id)
            )

        if time.time() > deadline:
            return err("TIMEOUT", "Document processing timed out. Please try again.")

    except Exception as e:
        return err("PIPELINE_ERROR", f"Processing failed: {str(e)[:200]}")

    # Determine overall status
    has_failed = any(s["status"] == "failed" for s in step_results)
    status_val = "needs_review" if has_failed else "synced"

    # ── Store in MongoDB ──────────────────────────────────────────────────
    doc = {
        "_id": resume_id,
        "userId": user_id,
        "submissionId": submission_id,
        "intakeMethod": intake_method,
        "status": status_val,
        "extractedText": extracted_text,
        "screeningReport": step_results,
        "perceptualHash": phash,
        "skills": [],  # populated by NLP pipeline (Phase 4)
        "disclaimer": RESUME_DISCLAIMER,
        "createdAt": now,
        "updatedAt": now,
    }
    await db["resumes"].insert_one(doc)

    return ok(_format_resume(doc))


# ── GET /api/v1/resumes/{id} ──────────────────────────────────────────────────

@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    doc = await db["resumes"].find_one({"_id": resume_id, "userId": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found.")
    return ok(_format_resume(doc))


# ── DELETE /api/v1/resumes/{id} ───────────────────────────────────────────────

@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    doc = await db["resumes"].find_one({"_id": resume_id, "userId": user_id}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found.")
    await db["resumes"].delete_one({"_id": resume_id})
    # Log deletion (without content)
    await db["deletion_log"].insert_one({
        "_id": str(uuid.uuid4()),
        "resumeId": resume_id,
        "userId": user_id,
        "deletedAt": datetime.now(tz=timezone.utc),
    })
    return ok({"ok": True})


# ── POST /api/v1/resumes/{id}/detect-document ─────────────────────────────────

@router.post("/{resume_id}/detect-document")
async def detect_document_live(
    resume_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    """
    Live document detection for camera method.
    Accepts a base64 image frame and returns hints + suggested corners.
    """
    body = await request.json()
    image_b64 = body.get("imageBase64", "")
    if not image_b64:
        return err("MISSING_IMAGE", "No imageBase64 provided.")

    try:
        raw_bytes = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(raw_bytes))
    except Exception:
        return err("INVALID_IMAGE", "Could not decode image.")

    # Quality hints
    quality_result = check_quality(img)
    hints = []
    for flag in quality_result.flags:
        if "dark" in flag.lower():
            hints.append("Too dark — improve lighting.")
        elif "blur" in flag.lower():
            hints.append("Hold steady — image is blurry.")
        elif "resolution" in flag.lower():
            hints.append("Move closer — resolution too low.")
        else:
            hints.append(flag)

    # Document detection
    _, corners = detect_document(img)
    if corners:
        hints.append("Page detected.")
    else:
        hints.append("No page outline found — align the document within the frame.")

    return ok({
        "hints": hints,
        "suggestedCorners": corners,
    })


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_resume(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "userId": doc["userId"],
        "submissionId": doc["submissionId"],
        "intakeMethod": doc["intakeMethod"],
        "status": doc["status"],
        "skills": doc.get("skills", []),
        "screeningReport": doc.get("screeningReport", []),
        "disclaimer": doc.get("disclaimer", ""),
        "createdAt": doc["createdAt"].isoformat() if hasattr(doc["createdAt"], "isoformat") else str(doc["createdAt"]),
        "updatedAt": doc["updatedAt"].isoformat() if hasattr(doc["updatedAt"], "isoformat") else str(doc["updatedAt"]),
    }


async def _get_prior_hashes(db: AsyncDatabase, user_id: str) -> list[str]:
    cursor = db["resumes"].find(
        {"userId": user_id, "perceptualHash": {"$exists": True, "$ne": ""}},
        {"perceptualHash": 1},
    )
    hashes = []
    async for doc in cursor:
        if doc.get("perceptualHash"):
            hashes.append(doc["perceptualHash"])
    return hashes


def _pdf_to_image(data: bytes) -> Image.Image | None:
    try:
        import fitz
        doc = fitz.open(stream=data, filetype="pdf")
        page = doc[0]
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for resolution
        pix = page.get_pixmap(matrix=mat)
        doc.close()
        return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    except Exception:
        return None
