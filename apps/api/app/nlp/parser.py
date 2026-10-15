"""
Section-aware resume parser — apps/api/app/nlp/parser.py

Splits extracted resume text into sections, extracts skill candidates,
assigns evidence levels, and maps each skill to ESCO.

Evidence levels (Section 7):
  Verified (3):     skill in Certifications section with a checkable artifact
                    (URL or cert ID format recognised)
  Demonstrated (2): skill in Experience or Projects with a concrete stated
                    outcome (quantified result pattern detected)
  Claimed (1):      skill in Skills section alone, or Experience/Projects
                    without a quantified outcome
  Absent (0):       not found
"""

import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ── Section headers ───────────────────────────────────────────────────────────
SECTION_PATTERNS: dict[str, list[str]] = {
    "Experience":      [r"experience", r"work history", r"employment"],
    "Projects":        [r"projects?", r"portfolio", r"side projects?"],
    "Education":       [r"education", r"academic", r"qualifications?"],
    "Certifications":  [r"certifications?", r"certificates?", r"credentials?", r"licen[cs]es?"],
    "Skills":          [r"skills?", r"technical skills?", r"competenc", r"expertise"],
    "Other":           [],
}

# Pattern: quantified outcome (for Demonstrated evidence)
# e.g. "reduced latency by 30%", "increased accuracy to 94%"
_QUANTIFIED_OUTCOME = re.compile(
    r"(\b(reduc|increas|improv|achiev|deliver|complet|optim|accelerat|cut|grew|built|deploy)\w*"
    r"\b.{0,60}(\d+\s*%|\d+x|\d+\s*(ms|seconds?|hours?|days?|users?|requests?)))",
    re.IGNORECASE,
)

# Pattern: URL (for Verified evidence in Certifications/Projects)
_URL_PATTERN = re.compile(r"https?://\S+", re.IGNORECASE)

# Pattern: certificate ID (common formats)
_CERT_ID_PATTERN = re.compile(
    r"\b([A-Z0-9]{6,20}|[A-Z]{2,6}-\d{4,10}|[A-Z0-9]{3,8}/[A-Z0-9]{4,12})\b"
)


@dataclass
class ParsedSkillCandidate:
    id: str
    raw_text: str
    section: str
    evidence_level: int          # 0–3
    evidence_multiplier: float   # derived from evidence_level
    source_snippet: str
    # Filled by ESCO mapping:
    esco_uri: Optional[str] = None
    esco_label: Optional[str] = None
    esco_label_display: Optional[str] = None
    match_type: Optional[str] = None   # "exact" | "semantic" | None
    cosine_similarity: Optional[float] = None
    uncalibrated: bool = False


EVIDENCE_MULTIPLIERS: dict[int, float] = {3: 1.0, 2: 0.85, 1: 0.6, 0: 0.0}


def _evidence_for_section(section: str, text_block: str) -> int:
    """
    Assign evidence level based on section and content.
    """
    if section == "Certifications":
        has_url = bool(_URL_PATTERN.search(text_block))
        has_cert_id = bool(_CERT_ID_PATTERN.search(text_block))
        if has_url or has_cert_id:
            return 3   # Verified
        return 2       # Demonstrated (cert listed without checkable ID)
    if section in ("Experience", "Projects"):
        if _QUANTIFIED_OUTCOME.search(text_block):
            return 2   # Demonstrated
        return 1       # Claimed
    if section == "Skills":
        return 1       # Claimed
    if section == "Education":
        return 1       # Claimed
    return 1


def split_sections(text: str) -> dict[str, str]:
    """
    Split resume text into named sections.
    Returns dict mapping section name → text block.
    """
    lines = text.splitlines()
    sections: dict[str, list[str]] = {"Other": []}
    current = "Other"

    for line in lines:
        stripped = line.strip()
        matched_section = None
        for section, patterns in SECTION_PATTERNS.items():
            for pat in patterns:
                if re.match(r"^" + pat + r"[\s:]*$", stripped, re.IGNORECASE):
                    matched_section = section
                    break
            if matched_section:
                break

        if matched_section:
            current = matched_section
            if current not in sections:
                sections[current] = []
        else:
            sections.setdefault(current, []).append(line)

    return {k: "\n".join(v) for k, v in sections.items() if v}


def extract_skill_candidates(text: str) -> list[str]:
    """
    Extract potential skill tokens from text using spaCy when available,
    falling back to noun-phrase heuristics.
    """
    try:
        import spacy
        try:
            nlp = _get_spacy_model()
            doc = nlp(text[:100_000])  # cap for performance
            candidates = set()
            for chunk in doc.noun_chunks:
                c = chunk.text.strip()
                if 2 <= len(c) <= 60:
                    candidates.add(c)
            for ent in doc.ents:
                if ent.label_ in ("ORG", "PRODUCT", "GPE", "WORK_OF_ART", "EVENT"):
                    candidates.add(ent.text.strip())
            return list(candidates)
        except Exception:
            pass
    except ImportError:
        pass

    # Heuristic fallback: split on commas, newlines, bullet chars
    raw = re.split(r"[,\n•·▪▸\-–]", text)
    candidates = []
    for item in raw:
        item = item.strip(" \t.")
        if 2 <= len(item) <= 60 and re.search(r"[a-zA-Z]", item):
            candidates.append(item)
    return candidates


_spacy_nlp = None

def _get_spacy_model():
    global _spacy_nlp
    if _spacy_nlp is None:
        import spacy
        try:
            _spacy_nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Download if missing
            from spacy.cli import download
            download("en_core_web_sm")
            _spacy_nlp = spacy.load("en_core_web_sm")
    return _spacy_nlp


def parse_resume(extracted_text: str) -> list[ParsedSkillCandidate]:
    """
    Full pipeline: split → extract candidates → assign evidence → map to ESCO.
    """
    from app.nlp.esco_loader import load_esco_index, _normalize
    from app.nlp.semantic_matcher import semantic_match

    index = load_esco_index()
    sections = split_sections(extracted_text)
    results: list[ParsedSkillCandidate] = []
    seen_esco_uris: set[str] = set()

    for section_name, section_text in sections.items():
        candidates = extract_skill_candidates(section_text)
        evidence_level = _evidence_for_section(section_name, section_text)

        for raw in candidates:
            raw_clean = raw.strip()
            if not raw_clean:
                continue

            # 1. Try exact ESCO alias match
            esco_skill = index.lookup(raw_clean)
            if esco_skill:
                # De-duplicate: keep highest evidence level per ESCO skill
                if esco_skill.uri in seen_esco_uris:
                    # Update existing if new evidence is higher
                    for existing in results:
                        if existing.esco_uri == esco_skill.uri:
                            if evidence_level > existing.evidence_level:
                                existing.evidence_level = evidence_level
                                existing.evidence_multiplier = EVIDENCE_MULTIPLIERS[evidence_level]
                                existing.section = section_name
                    continue

                seen_esco_uris.add(esco_skill.uri)
                results.append(ParsedSkillCandidate(
                    id=str(uuid.uuid4()),
                    raw_text=raw_clean,
                    section=section_name,
                    evidence_level=evidence_level,
                    evidence_multiplier=EVIDENCE_MULTIPLIERS[evidence_level],
                    source_snippet=_snippet(section_text, raw_clean),
                    esco_uri=esco_skill.uri,
                    esco_label=esco_skill.label,
                    esco_label_display=esco_skill.label_display,
                    match_type="exact",
                    uncalibrated=False,
                ))
                continue

            # 2. Semantic match (uncalibrated)
            matches = semantic_match(raw_clean, top_k=1)
            if matches:
                m = matches[0]
                if m.esco_uri in seen_esco_uris:
                    continue
                seen_esco_uris.add(m.esco_uri)
                results.append(ParsedSkillCandidate(
                    id=str(uuid.uuid4()),
                    raw_text=raw_clean,
                    section=section_name,
                    evidence_level=evidence_level,
                    evidence_multiplier=EVIDENCE_MULTIPLIERS[evidence_level],
                    source_snippet=_snippet(section_text, raw_clean),
                    esco_uri=m.esco_uri,
                    esco_label=m.esco_label,
                    esco_label_display=m.esco_label_display,
                    match_type="semantic",
                    cosine_similarity=m.cosine_similarity,
                    uncalibrated=True,
                ))

    return results


def _snippet(text: str, term: str, window: int = 80) -> str:
    """Extract a short context snippet around the term."""
    idx = text.lower().find(term.lower())
    if idx < 0:
        return text[:80]
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(term) + window // 2)
    return text[start:end].replace("\n", " ").strip()
