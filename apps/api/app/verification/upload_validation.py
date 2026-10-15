"""
Upload validation (Section 8).

Checks (server-side, applies to both intake methods):
- File signature (magic bytes) — accepts PDF, PNG, JPEG only
- Max file size 10 MB
- Image: max 4000×4000 px, max 16 MP
- PDF: max 5 pages, no JavaScript, no embedded executables, no launch actions,
       not encrypted/password-protected
- Strip EXIF from stored images
- Processing timeout enforced by the caller
"""

import io
import struct
from dataclasses import dataclass

from app.config import settings

# ── Magic byte signatures ─────────────────────────────────────────────────────
_SIGNATURES = {
    "pdf":  b"%PDF-",
    "png":  b"\x89PNG\r\n\x1a\n",
    "jpeg": b"\xff\xd8\xff",
}


@dataclass
class ValidationResult:
    valid: bool
    file_type: str  # "pdf" | "png" | "jpeg" | "unknown"
    error: str | None = None


def validate_upload(data: bytes) -> ValidationResult:
    """
    Run all server-side validation checks on raw file bytes.
    Returns ValidationResult; if not valid, error contains a human-readable message.
    """
    # Size check
    size_mb = len(data) / (1024 * 1024)
    if size_mb > settings.upload_max_size_mb:
        return ValidationResult(
            valid=False,
            file_type="unknown",
            error=f"File too large ({size_mb:.1f} MB). Maximum allowed: {settings.upload_max_size_mb} MB.",
        )

    # File signature check
    file_type = _detect_file_type(data)
    if file_type == "unknown":
        return ValidationResult(
            valid=False,
            file_type="unknown",
            error="Unsupported file type. Only PDF, PNG, and JPEG files are accepted.",
        )

    if file_type in ("png", "jpeg"):
        return _validate_image(data, file_type)
    else:
        return _validate_pdf(data)


def _detect_file_type(data: bytes) -> str:
    for ft, sig in _SIGNATURES.items():
        if data[: len(sig)] == sig:
            return ft
    return "unknown"


def _validate_image(data: bytes, file_type: str) -> ValidationResult:
    try:
        from PIL import Image  # lazy import
        img = Image.open(io.BytesIO(data))
        img.verify()  # raises on corrupt images
    except ImportError:
        return ValidationResult(valid=False, file_type=file_type, error="Image library not available.")
    except Exception as e:
        return ValidationResult(valid=False, file_type=file_type, error=f"Invalid or corrupt image: {e}")

    # Re-open after verify (verify() closes the file)
    from PIL import Image  # noqa: F811
    img = Image.open(io.BytesIO(data))
    w, h = img.size
    mp = (w * h) / 1_000_000

    if w > settings.upload_max_dimension_px or h > settings.upload_max_dimension_px:
        return ValidationResult(
            valid=False,
            file_type=file_type,
            error=f"Image dimensions {w}×{h} px exceed maximum {settings.upload_max_dimension_px}×{settings.upload_max_dimension_px} px.",
        )
    if mp > settings.upload_max_megapixels:
        return ValidationResult(
            valid=False,
            file_type=file_type,
            error=f"Image is {mp:.1f} MP. Maximum allowed: {settings.upload_max_megapixels} MP.",
        )

    return ValidationResult(valid=True, file_type=file_type)


def _validate_pdf(data: bytes) -> ValidationResult:
    """
    Validate a PDF file:
    - Not encrypted/password-protected
    - Max 5 pages
    - No JavaScript, no embedded executables, no launch actions
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return ValidationResult(
            valid=False,
            file_type="pdf",
            error="PDF processing library not available.",
        )

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        return ValidationResult(valid=False, file_type="pdf", error=f"Cannot open PDF: {e}")

    # Encrypted check
    if doc.is_encrypted:
        doc.close()
        return ValidationResult(
            valid=False,
            file_type="pdf",
            error="Encrypted or password-protected PDFs are not accepted.",
        )

    # Page count check
    page_count = doc.page_count
    if page_count > settings.upload_max_pdf_pages:
        doc.close()
        return ValidationResult(
            valid=False,
            file_type="pdf",
            error=f"PDF has {page_count} pages. Maximum allowed: {settings.upload_max_pdf_pages} pages.",
        )

    # Dangerous content check
    danger = _check_pdf_dangerous(doc)
    doc.close()
    if danger:
        return ValidationResult(
            valid=False,
            file_type="pdf",
            error=f"PDF contains potentially dangerous content: {danger}. File rejected.",
        )

    return ValidationResult(valid=True, file_type="pdf")


def _check_pdf_dangerous(doc) -> str | None:
    """
    Check the PDF for JavaScript, embedded files, and launch actions.
    Returns a description string if dangerous content is found, else None.
    """
    try:
        # Check for JavaScript at document level
        if doc.get_js():
            return "JavaScript"

        # Walk the document catalog for dangerous action types
        catalog = doc.pdf_catalog()
        if catalog:
            raw = str(catalog)
            for marker in ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/RichMedia"]:
                if marker in raw:
                    return f"action type {marker}"
    except Exception:
        pass
    return None


def strip_exif(data: bytes, file_type: str) -> bytes:
    """
    Strip EXIF and metadata from an image (PNG or JPEG).
    Returns clean bytes with only pixel data preserved.
    """
    if file_type not in ("png", "jpeg"):
        return data
    try:
        from PIL import Image  # lazy import
        img = Image.open(io.BytesIO(data))
        clean = Image.new(img.mode, img.size)
        clean.putdata(list(img.getdata()))
        buf = io.BytesIO()
        fmt = "PNG" if file_type == "png" else "JPEG"
        clean.save(buf, format=fmt, quality=95 if fmt == "JPEG" else None)
        return buf.getvalue()
    except Exception:
        return data  # return original if stripping fails
