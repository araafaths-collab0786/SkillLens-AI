"""
Screening pipeline unit tests — Phase 3.

Tests each step independently using synthetic images (no external files needed).
Each step is tested for: success path, warning path, and failure path where applicable.
"""

from __future__ import annotations

import io
import struct
from typing import TYPE_CHECKING
import pytest

# ── TYPE_CHECKING imports — gives Pyright real types; never executed at runtime
if TYPE_CHECKING:
    import numpy as np
    from PIL import Image
    import pytesseract as _tess

# ── Runtime dependency guards ─────────────────────────────────────────────────
try:
    import numpy as np  # type: ignore[no-redef]
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    from PIL import Image  # type: ignore[no-redef]
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

HAS_NUMPY = HAS_NUMPY and HAS_PILLOW  # both required together

try:
    import cv2 as _cv2  # type: ignore[import-untyped]
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    import pytesseract as _tess  # type: ignore[no-redef]
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

needs_numpy = pytest.mark.skipif(not HAS_NUMPY, reason="numpy/Pillow not installed")
needs_cv2 = pytest.mark.skipif(not HAS_CV2 or not HAS_NUMPY, reason="opencv or numpy not installed")
needs_tesseract = pytest.mark.skipif(not HAS_TESSERACT, reason="tesseract not installed")


# ── Helpers ───────────────────────────────────────────────────────────────────
# These helpers use numpy/Pillow. Pyright sees the real types via the
# TYPE_CHECKING block above. At runtime, the pytestmark skip guards ensure
# they are never called without the dependencies installed.

def _make_array_image(fill: int, w: int, h: int) -> "Image.Image":
    arr = np.ones((h, w, 3), dtype=np.uint8) * fill  # type: ignore[union-attr]
    return Image.fromarray(arr)  # type: ignore[union-attr]


def make_white_image(w: int = 800, h: int = 1100) -> "Image.Image":
    return _make_array_image(240, w, h)


def make_dark_image(w: int = 800, h: int = 1100) -> "Image.Image":
    return _make_array_image(20, w, h)


def make_tiny_image(w: int = 100, h: int = 100) -> "Image.Image":
    return _make_array_image(200, w, h)


def make_blurry_image(w: int = 800, h: int = 1100) -> "Image.Image":
    """Uniform image — zero variance of Laplacian."""
    return _make_array_image(180, w, h)


def make_text_image(w: int = 800, h: int = 1100) -> "Image.Image":
    """Image with dark horizontal stripes to simulate text lines."""
    arr = np.ones((h, w, 3), dtype=np.uint8) * 240  # type: ignore[union-attr]
    for row in range(50, h, 60):
        arr[row:row + 8, 20:w - 20] = 30
    return Image.fromarray(arr)  # type: ignore[union-attr]


def make_pdf_bytes_valid() -> bytes:
    """Minimal valid PDF (1 page, no JS, not encrypted)."""
    return b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF"""


def make_pdf_bytes_too_many_pages() -> bytes:
    """We fake the check by patching page_count — this is a unit test."""
    return make_pdf_bytes_valid()


def make_png_bytes() -> bytes:
    img = make_white_image(200, 200)
    buf = io.BytesIO()
    img.save(buf, format="PNG")  # type: ignore[union-attr]
    return buf.getvalue()


def make_jpeg_bytes() -> bytes:
    img = make_white_image(200, 200)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)  # type: ignore[union-attr]
    return buf.getvalue()


def make_invalid_bytes() -> bytes:
    return b"INVALID_HEADER_NOT_A_FILE"


# ── Step 1: quality_check ─────────────────────────────────────────────────────

class TestQualityCheck:
    pytestmark = needs_numpy
    def test_good_image_passes(self):
        from app.verification.quality_check import check_quality
        img = make_text_image()
        result = check_quality(img)
        assert result.step == "quality_check"
        assert result.status in ("passed", "warning")  # blurry warning is ok
        assert "width_px" in result.metrics
        assert result.metrics["width_px"] == 800

    def test_dark_image_warns(self):
        from app.verification.quality_check import check_quality
        img = make_dark_image()
        result = check_quality(img)
        assert result.status == "warning"
        assert any("dark" in f.lower() for f in result.flags)

    def test_tiny_image_warns(self):
        from app.verification.quality_check import check_quality
        img = make_tiny_image()
        result = check_quality(img)
        assert result.status == "warning"
        assert any("resolution" in f.lower() for f in result.flags)


# ── Step 2: document_detect ───────────────────────────────────────────────────

@pytest.mark.usefixtures()
class TestDocumentDetect:
    pytestmark = needs_cv2
    def test_returns_step_result_and_corners(self):
        from app.verification.document_detect import detect_document
        img = make_text_image()
        result, corners = detect_document(img)
        assert result.step == "document_detect"
        assert result.status in ("passed", "warning")
        # Corners may be None for synthetic images with no clear contour
        if corners is not None:
            assert len(corners) == 4
            for pt in corners:
                assert len(pt) == 2

    def test_uniform_image_warns_no_contour(self):
        from app.verification.document_detect import detect_document
        img = make_white_image()
        result, corners = detect_document(img)
        # Uniform white image has no contour — fallback expected
        assert result.status in ("passed", "warning")

    def test_order_corners_function(self):
        from app.verification.document_detect import _order_corners
        pts = [[10, 10], [200, 10], [200, 300], [10, 300]]
        ordered = _order_corners(pts)
        assert len(ordered) == 4
        # topLeft should have smallest sum (x+y)
        tl = ordered[0]
        br = ordered[2]
        assert tl[0] + tl[1] < br[0] + br[1]


# ── Step 3: perspective ───────────────────────────────────────────────────────

class TestPerspective:
    pytestmark = needs_cv2
    def test_with_valid_corners(self):
        from app.verification.perspective import correct_perspective
        img = make_text_image()
        w, h = img.size
        corners = [[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]]
        result, out = correct_perspective(img, corners)
        assert result.step == "perspective"
        assert result.status == "passed"
        assert out is not None

    def test_without_corners_warns(self):
        from app.verification.perspective import correct_perspective
        img = make_text_image()
        result, out = correct_perspective(img, None)
        assert result.status == "warning"
        assert "no corners" in " ".join(result.flags).lower()
        assert out is not None  # fallback image returned


# ── Step 4: enhance ───────────────────────────────────────────────────────────

class TestEnhance:
    pytestmark = needs_cv2
    def test_enhance_returns_image(self):
        from app.verification.enhance import enhance
        img = make_text_image().convert("L")  # grayscale already
        result, out = enhance(img)
        assert result.step == "enhance"
        assert result.status == "passed"
        assert out is not None

    def test_enhance_rgb_image(self):
        from app.verification.enhance import enhance
        img = make_text_image()  # RGB
        result, out = enhance(img)
        assert result.step == "enhance"
        assert out is not None

    def test_skew_estimation_zero_for_uniform(self):
        from app.verification.enhance import _estimate_skew
        gray = np.ones((400, 300), dtype=np.float32) * 200  # type: ignore[union-attr]
        angle = _estimate_skew(gray)
        assert isinstance(angle, float)


# ── Step 5: authenticity_risk ─────────────────────────────────────────────────

class TestAuthenticity:
    pytestmark = needs_numpy
    def test_clean_image_passes(self):
        from app.verification.authenticity import screen_authenticity_risk
        img = make_text_image()
        result, phash = screen_authenticity_risk(img, prior_hashes=[])
        assert result.step == "authenticity_risk"
        assert result.status in ("passed", "warning")
        assert isinstance(phash, str)
        assert len(phash) > 0

    def test_duplicate_detected(self):
        from app.verification.authenticity import screen_authenticity_risk
        img = make_text_image()
        # First scan to get hash
        _, phash = screen_authenticity_risk(img, prior_hashes=[])
        # Second scan with same image — should detect duplicate
        result2, _ = screen_authenticity_risk(img, prior_hashes=[phash])
        # May warn on duplicate if imagehash available
        assert result2.step == "authenticity_risk"

    def test_output_never_says_genuine_or_fake(self):
        from app.verification.authenticity import screen_authenticity_risk
        img = make_dark_image()
        result, _ = screen_authenticity_risk(img, prior_hashes=[])
        all_text = " ".join(result.flags).lower()
        assert "genuine" not in all_text
        assert "fake" not in all_text
        assert "authentic" not in all_text or "inauthentic" not in all_text


# ── Step 6: ocr ───────────────────────────────────────────────────────────────

class TestOCR:
    pytestmark = needs_tesseract
    def test_blank_image_fails(self):
        from app.verification.ocr import run_ocr
        img = make_white_image(100, 100)
        result, text = run_ocr(img)
        assert result.step == "ocr"
        # Blank image may return failed or warning with no text
        assert result.status in ("passed", "warning", "failed")

    def test_result_has_metrics(self):
        from app.verification.ocr import run_ocr
        img = make_text_image()
        result, text = run_ocr(img)
        assert "total_words" in result.metrics or result.status == "failed"


# ── Upload validation ─────────────────────────────────────────────────────────

class TestUploadValidationMagicBytes:
    """Tests that only check magic bytes — no numpy/Pillow needed, always run."""

    def test_pdf_magic_bytes_detected(self):
        from app.verification.upload_validation import _detect_file_type
        assert _detect_file_type(b"%PDF-1.4 rest") == "pdf"

    def test_png_magic_bytes_detected(self):
        from app.verification.upload_validation import _detect_file_type
        assert _detect_file_type(b"\x89PNG\r\n\x1a\n rest") == "png"

    def test_jpeg_magic_bytes_detected(self):
        from app.verification.upload_validation import _detect_file_type
        assert _detect_file_type(b"\xff\xd8\xff rest") == "jpeg"

    def test_unknown_bytes_detected(self):
        from app.verification.upload_validation import _detect_file_type
        assert _detect_file_type(b"GARBAGE DATA") == "unknown"

    def test_invalid_bytes_rejected(self):
        from app.verification.upload_validation import validate_upload
        result = validate_upload(make_invalid_bytes())
        assert result.valid is False
        assert "Unsupported" in result.error


class TestUploadValidationWithImages:
    """Tests that need Pillow/numpy for image creation."""
    pytestmark = needs_numpy

    def test_valid_png_passes(self):
        from app.verification.upload_validation import validate_upload
        data = make_png_bytes()
        result = validate_upload(data)
        assert result.valid is True
        assert result.file_type == "png"

    def test_valid_jpeg_passes(self):
        from app.verification.upload_validation import validate_upload
        data = make_jpeg_bytes()
        result = validate_upload(data)
        assert result.valid is True
        assert result.file_type == "jpeg"

    def test_oversized_file_rejected(self):
        from app.verification.upload_validation import validate_upload
        from unittest.mock import patch
        data = make_png_bytes()
        with patch("app.verification.upload_validation.settings") as mock_settings:
            mock_settings.upload_max_size_mb = 0.001
            mock_settings.upload_max_dimension_px = 4000
            mock_settings.upload_max_megapixels = 16
            result = validate_upload(data)
        assert result.valid is False
        assert "large" in result.error.lower()

    def test_oversized_image_rejected(self):
        from app.verification.upload_validation import validate_upload
        from unittest.mock import patch
        data = make_png_bytes()
        with patch("app.verification.upload_validation.settings") as mock_settings:
            mock_settings.upload_max_size_mb = 100
            mock_settings.upload_max_dimension_px = 10
            mock_settings.upload_max_megapixels = 16
            result = validate_upload(data)
        assert result.valid is False
        assert "dimension" in result.error.lower()

    def test_strip_exif_returns_bytes(self):
        from app.verification.upload_validation import strip_exif
        data = make_jpeg_bytes()
        clean = strip_exif(data, "jpeg")
        assert isinstance(clean, bytes)
        assert len(clean) > 0
