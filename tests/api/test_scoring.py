"""
Scoring module unit tests — Phase 4.

Tests cover:
1. Readiness Index formula with worked examples (Section 7)
2. Edge cases (all missing, all verified, single skill)
3. Gap severity classification (High / Medium / Low)
4. Projected readiness computation
5. Evidence multipliers
6. ESCO alias index (exact lookup, abbreviations, normalization)
7. Section parser (section splitting, evidence assignment)
8. Calibration harness gate (blocked without Gate 3)
"""

import pytest


# ── 1. Readiness Index — worked examples ─────────────────────────────────────

class TestReadinessIndex:

    def _make_candidate(self, esco_uri, s, evidence_level, uncalibrated=False):
        return {
            "esco_uri": esco_uri,
            "s": s,
            "evidence_level": evidence_level,
            "uncalibrated": uncalibrated,
            "source_snippet": "",
        }

    def _make_required(self, esco_uri, label, weight):
        return {"esco_uri": esco_uri, "esco_label": label, "weight": weight}

    def test_perfect_score(self):
        """All skills Verified (e=1.0) and exact match (s=1.0) → 100."""
        from app.scoring.readiness import compute_readiness
        candidates = [
            self._make_candidate("A", 1.0, 3),
            self._make_candidate("B", 1.0, 3),
        ]
        required = [
            self._make_required("A", "Skill A", 2),
            self._make_required("B", "Skill B", 3),
        ]
        result = compute_readiness(candidates, required)
        assert result.readiness_index == 100
        assert result.uncalibrated is False

    def test_all_missing(self):
        """No matching skills → 0."""
        from app.scoring.readiness import compute_readiness
        candidates = []
        required = [
            self._make_required("X", "Skill X", 3),
            self._make_required("Y", "Skill Y", 2),
        ]
        result = compute_readiness(candidates, required)
        assert result.readiness_index == 0

    def test_worked_example_section7(self):
        """
        Worked example from Section 7:
          3 required skills: w=[3, 2, 1], Σw=6
          Skill A: s=1.0, e=0.85 (Demonstrated)  → contribution = 1.0×0.85×3 = 2.55
          Skill B: s=0.85, e=0.6 (Claimed)        → contribution = 0.85×0.6×2 = 1.02  [uncalibrated]
          Skill C: missing                         → contribution = 0
          Readiness = 100 × (2.55 + 1.02) / 6 = 100 × 3.57 / 6 ≈ 59.5 → rounds to 60
        """
        from app.scoring.readiness import compute_readiness
        candidates = [
            self._make_candidate("A", 1.0, 2, False),       # Demonstrated, exact
            self._make_candidate("B", 0.85, 1, True),       # Claimed, semantic UNCALIBRATED
        ]
        required = [
            self._make_required("A", "Skill A", 3),
            self._make_required("B", "Skill B", 2),
            self._make_required("C", "Skill C", 1),
        ]
        result = compute_readiness(candidates, required)
        # Manual: (1.0*0.85*3 + 0.85*0.6*2 + 0) / 6 * 100
        expected = round(100 * (2.55 + 1.02) / 6)
        assert result.readiness_index == expected
        assert result.uncalibrated is True   # B is uncalibrated

    def test_single_skill_claimed(self):
        """Single required skill, Claimed → 0.6 * 100 = 60."""
        from app.scoring.readiness import compute_readiness
        candidates = [self._make_candidate("A", 1.0, 1)]
        required = [self._make_required("A", "A", 1)]
        result = compute_readiness(candidates, required)
        assert result.readiness_index == 60

    def test_single_skill_verified(self):
        """Single required skill, Verified → 100."""
        from app.scoring.readiness import compute_readiness
        candidates = [self._make_candidate("A", 1.0, 3)]
        required = [self._make_required("A", "A", 1)]
        result = compute_readiness(candidates, required)
        assert result.readiness_index == 100

    def test_clamped_to_100(self):
        """Result must never exceed 100."""
        from app.scoring.readiness import compute_readiness
        candidates = [self._make_candidate("A", 1.0, 3), self._make_candidate("B", 1.0, 3)]
        required   = [self._make_required("A", "A", 3), self._make_required("B", "B", 3)]
        result = compute_readiness(candidates, required)
        assert result.readiness_index <= 100

    def test_clamped_to_0(self):
        """Result must never be negative."""
        from app.scoring.readiness import compute_readiness
        result = compute_readiness([], [self._make_required("X", "X", 3)])
        assert result.readiness_index >= 0

    def test_empty_required_skills(self):
        """No required skills → readiness 0 (no denominator)."""
        from app.scoring.readiness import compute_readiness
        result = compute_readiness([], [])
        assert result.readiness_index == 0


# ── 2. Evidence multipliers ───────────────────────────────────────────────────

class TestEvidenceMultipliers:
    def test_all_levels(self):
        from app.scoring.constants import EVIDENCE_MULTIPLIER
        assert EVIDENCE_MULTIPLIER[3] == 1.0
        assert EVIDENCE_MULTIPLIER[2] == 0.85
        assert EVIDENCE_MULTIPLIER[1] == 0.6
        assert EVIDENCE_MULTIPLIER[0] == 0.0

    def test_contribution_scales_with_evidence(self):
        """Higher evidence → higher contribution for same s and w."""
        from app.scoring.readiness import compute_readiness
        def readiness_for_level(level):
            c = [{"esco_uri": "A", "s": 1.0, "evidence_level": level, "uncalibrated": False, "source_snippet": ""}]
            r = [{"esco_uri": "A", "esco_label": "A", "weight": 1}]
            return compute_readiness(c, r).readiness_index

        assert readiness_for_level(3) > readiness_for_level(2)
        assert readiness_for_level(2) > readiness_for_level(1)
        assert readiness_for_level(1) > readiness_for_level(0)


# ── 3. Gap severity ───────────────────────────────────────────────────────────

class TestGapSeverity:
    def test_high_gap(self):
        from app.scoring.gap import classify_severity
        # w=3, s*e = 0 < 0.5
        assert classify_severity(3, 0.0, 0.0) == "High"
        assert classify_severity(3, 0.5, 0.5) == "High"   # s*e=0.25

    def test_medium_gap_weight2(self):
        from app.scoring.gap import classify_severity
        # w=2, s*e < 0.5
        assert classify_severity(2, 0.3, 0.6) == "Medium"  # s*e=0.18

    def test_medium_gap_weight3_mid(self):
        from app.scoring.gap import classify_severity
        # w=3, 0.5 ≤ s*e < 0.85
        assert classify_severity(3, 0.9, 0.7) == "Medium"  # s*e=0.63

    def test_low_gap(self):
        from app.scoring.gap import classify_severity
        assert classify_severity(1, 0.5, 0.6) == "Low"

    def test_no_gap_full_score(self):
        from app.scoring.gap import classify_severity
        # s*e = 1.0 → no gap
        assert classify_severity(3, 1.0, 1.0) is None

    def test_severity_order(self):
        """High severity gaps sort before Medium, then Low."""
        from app.scoring.readiness import compute_readiness, SkillScore
        from app.scoring.gap import build_gaps
        r = compute_readiness(
            candidate_skills=[],
            required_skills=[
                {"esco_uri": "H", "esco_label": "High Skill",   "weight": 3},
                {"esco_uri": "M", "esco_label": "Medium Skill", "weight": 2},
                {"esco_uri": "L", "esco_label": "Low Skill",    "weight": 1},
            ],
        )
        gaps = build_gaps(r, [])
        severities = [g.severity for g in gaps]
        # High must come first
        assert severities[0] == "High"


# ── 4. Projected readiness ────────────────────────────────────────────────────

class TestProjectedReadiness:
    def test_projection_higher_than_current(self):
        """After completing top steps, projected readiness ≥ current."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [
            {"esco_uri": "A", "esco_label": "A", "weight": 3},
            {"esco_uri": "B", "esco_label": "B", "weight": 2},
        ]
        candidates = [
            {"esco_uri": "A", "s": 1.0, "evidence_level": 1, "uncalibrated": False, "source_snippet": ""},
        ]
        r = compute_readiness(candidates, required)
        steps = [
            {"esco_uri": "A", "step_type": "course", "title": "Course A", "effort_weeks": 4, "step_order": 1},
            {"esco_uri": "B", "step_type": "course", "title": "Course B", "effort_weeks": 4, "step_order": 2},
        ]
        gaps = build_gaps(r, steps)
        proj = compute_projected_readiness(gaps, r, required)
        assert proj.projected_readiness >= proj.current_readiness

    def test_projection_carries_disclaimer(self):
        from app.scoring.gap import compute_projected_readiness, build_gaps
        from app.scoring.readiness import compute_readiness
        r = compute_readiness([], [{"esco_uri": "X", "esco_label": "X", "weight": 1}])
        gaps = build_gaps(r, [])
        proj = compute_projected_readiness(gaps, r, [{"esco_uri": "X", "esco_label": "X", "weight": 1}])
        assert "Estimated" in proj.disclaimer
        assert "predict" in proj.disclaimer.lower()

    def test_projection_never_exceeds_100(self):
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [{"esco_uri": "A", "esco_label": "A", "weight": 1}]
        candidates = [{"esco_uri": "A", "s": 1.0, "evidence_level": 3, "uncalibrated": False, "source_snippet": ""}]
        r = compute_readiness(candidates, required)
        gaps = build_gaps(r, [])
        proj = compute_projected_readiness(gaps, r, required)
        assert proj.projected_readiness <= 100


# ── 5. ESCO alias index ───────────────────────────────────────────────────────

class TestEscoAliasIndex:
    def test_seed_loads(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        assert len(index) > 0

    def test_exact_lookup_canonical(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        skill = index.lookup("Python")
        assert skill is not None
        assert "python" in skill.label

    def test_abbreviation_k8s(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        skill = index.lookup("k8s")
        assert skill is not None
        assert "kubernetes" in skill.label.lower()

    def test_abbreviation_ml(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        skill = index.lookup("ML")
        assert skill is not None
        assert "machine learning" in skill.label.lower()

    def test_synonym_nodejs(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        skill = index.lookup("node.js")
        assert skill is not None

    def test_unknown_returns_none(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        assert index.lookup("xyzabcnotaskill123") is None

    def test_case_insensitive(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        assert index.lookup("PYTHON") == index.lookup("python")

    def test_normalization(self):
        from app.nlp.esco_loader import _normalize
        assert _normalize("  Machine  Learning  ") == "machine learning"
        assert _normalize("TypeScript!") == "typescript"


# ── 6. Section parser ─────────────────────────────────────────────────────────

class TestSectionParser:
    def test_split_sections_basic(self):
        from app.nlp.parser import split_sections
        text = "Skills\nPython\nJavaScript\n\nExperience\nBuilt a REST API"
        sections = split_sections(text)
        assert "Skills" in sections or "Other" in sections

    def test_evidence_for_skills_section_is_claimed(self):
        from app.nlp.parser import _evidence_for_section
        assert _evidence_for_section("Skills", "Python JavaScript") == 1

    def test_evidence_for_certifications_with_url_is_verified(self):
        from app.nlp.parser import _evidence_for_section
        assert _evidence_for_section("Certifications", "AWS https://cert.ly/abc123") == 3

    def test_evidence_for_certifications_without_artifact_is_demonstrated(self):
        from app.nlp.parser import _evidence_for_section
        assert _evidence_for_section("Certifications", "AWS Certified Solutions Architect") == 2

    def test_evidence_for_experience_with_outcome(self):
        from app.nlp.parser import _evidence_for_section
        text = "Reduced inference latency by 30% using Python"
        assert _evidence_for_section("Experience", text) == 2

    def test_evidence_for_experience_without_outcome(self):
        from app.nlp.parser import _evidence_for_section
        assert _evidence_for_section("Experience", "Used Python at work") == 1

    def test_extract_candidates_fallback(self):
        from app.nlp.parser import extract_skill_candidates
        text = "Python, JavaScript, SQL\nDocker"
        candidates = extract_skill_candidates(text)
        assert len(candidates) > 0
        assert any("Python" in c or "python" in c.lower() for c in candidates)

    def test_evidence_for_education_is_claimed(self):
        from app.nlp.parser import _evidence_for_section
        assert _evidence_for_section("Education", "B.Sc. Computer Science") == 1

    def test_evidence_for_other_section_is_claimed(self):
        from app.nlp.parser import _evidence_for_section
        assert _evidence_for_section("Other", "some misc text") == 1

    def test_split_sections_with_experience(self):
        from app.nlp.parser import split_sections
        text = "Experience\nBuilt REST APIs\n\nSkills\nPython\nGit"
        sections = split_sections(text)
        assert "Experience" in sections or "Skills" in sections

    def test_split_sections_returns_nonempty_blocks(self):
        from app.nlp.parser import split_sections
        text = "Skills\nPython\nJavaScript\nDocker"
        sections = split_sections(text)
        # At least one section should have content
        assert any(len(v.strip()) > 0 for v in sections.values())

    def test_extract_candidates_comma_list(self):
        from app.nlp.parser import extract_skill_candidates
        text = "Python, JavaScript, Docker, Kubernetes"
        candidates = extract_skill_candidates(text)
        flat = " ".join(candidates).lower()
        assert "python" in flat
        assert "javascript" in flat

    def test_extract_candidates_bullet_list(self):
        from app.nlp.parser import extract_skill_candidates
        text = "• Python\n• Git\n• Docker"
        candidates = extract_skill_candidates(text)
        assert len(candidates) >= 1


# ── 7. ESCO loader — extended coverage ───────────────────────────────────────

class TestEscoLoaderExtended:
    def test_abbreviation_indexed_in_lookup(self):
        """Abbreviations defined in ABBREVIATIONS should resolve correctly."""
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        # 'js' should expand to 'javascript'
        js_skill = index.lookup("js")
        assert js_skill is not None
        assert "javascript" in js_skill.label.lower()

    def test_lookup_with_leading_trailing_spaces(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        # Should normalize whitespace
        result = index.lookup("  Python  ")
        assert result is not None

    def test_alt_labels_indexed(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        # "k8s" is an alt label for Kubernetes in the seed
        result = index.lookup("k8s")
        assert result is not None
        assert "kubernetes" in result.label.lower()

    def test_index_len_nonzero(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        assert len(index) > 0

    def test_skills_list_populated(self):
        from app.nlp.esco_loader import load_esco_index
        index = load_esco_index()
        assert len(index.skills) > 0

    def test_split_alt_labels_pipe(self):
        from app.nlp.esco_loader import _split_alt_labels
        result = _split_alt_labels("js|ecmascript|node.js")
        assert "js" in result
        assert "ecmascript" in result

    def test_split_alt_labels_newline(self):
        from app.nlp.esco_loader import _split_alt_labels
        result = _split_alt_labels("js\necmascript\nnode.js")
        assert "js" in result

    def test_split_alt_labels_empty(self):
        from app.nlp.esco_loader import _split_alt_labels
        assert _split_alt_labels("") == []

    def test_normalize_removes_punctuation(self):
        from app.nlp.esco_loader import _normalize
        assert _normalize("C++") == "c"
        assert _normalize("node.js") == "node js"

    def test_normalize_collapses_spaces(self):
        from app.nlp.esco_loader import _normalize
        assert _normalize("machine   learning") == "machine learning"


# ── 8. Calibration harness gate ───────────────────────────────────────────────

class TestCalibrationGate:
    def test_blocked_without_gate3_approval(self):
        """The calibration harness must refuse to run until Gate 3 is approved."""
        from app.scoring.calibration import run_calibration, GATE_3_APPROVED
        assert GATE_3_APPROVED is False

        with pytest.raises(RuntimeError, match="Gate 3"):
            run_calibration()

    def test_load_pairs_blocked_without_approval(self):
        from app.scoring.calibration import load_validation_pairs
        with pytest.raises(RuntimeError, match="Gate 3"):
            load_validation_pairs()
