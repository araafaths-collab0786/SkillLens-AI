"""
Phase 5 — Match and Gap Analysis tests.

Covers (all using pure Python, no HTTP client required):
1. compute_readiness with realistic job/candidate data
2. build_gaps — severity assignment, sorting, recommendation
3. compute_projected_readiness — top-3 selection, gain calculation
4. esco_relations — get_related_skills filters correctly
5. Gap router integration logic (business rules without MongoDB)
6. Worked examples with the exact formula (Section 7)
7. Projection disclaimer and uncalibrated flag propagation
8. Edge cases: no gaps, all gaps, single skill, empty candidate
"""

import pytest

# ── Helpers ───────────────────────────────────────────────────────────────────

def make_candidate(uri, s, evidence_level, uncalibrated=False, source_snippet=""):
    return {
        "esco_uri": uri,
        "s": s,
        "evidence_level": evidence_level,
        "uncalibrated": uncalibrated,
        "source_snippet": source_snippet,
    }

def make_required(uri, label, weight):
    return {"esco_uri": uri, "esco_label": label, "weight": weight}

def make_step(uri, step_type, title, effort_weeks, step_order):
    return {
        "esco_uri": uri,
        "step_type": step_type,
        "title": title,
        "effort_weeks": effort_weeks,
        "step_order": step_order,
    }


# ── 1. Readiness Index — Section 7 worked examples ───────────────────────────

class TestReadinessWorkedExamples:

    def test_full_stack_developer_partial_match(self):
        """
        Realistic scenario: candidate has Python (Verified, exact) and
        JavaScript (Claimed, exact) but is missing React.
        Required: Python w=3, JavaScript w=2, React w=3. Σw=8.
          Python:     s=1.0, e=1.0  → 1.0*1.0*3 = 3.0
          JavaScript: s=1.0, e=0.6  → 1.0*0.6*2 = 1.2
          React:      missing        → 0
          Readiness = 100 * 4.2 / 8 = 52.5 → 52 or 53 (round)
        """
        from app.scoring.readiness import compute_readiness
        candidates = [
            make_candidate("esco:python",     1.0, 3),
            make_candidate("esco:javascript", 1.0, 1),
        ]
        required = [
            make_required("esco:python",     "Python",     3),
            make_required("esco:javascript", "JavaScript", 2),
            make_required("esco:react",      "React",      3),
        ]
        result = compute_readiness(candidates, required)
        expected = round(100 * (3.0 + 1.2 + 0) / 8)
        assert result.readiness_index == expected
        assert result.readiness_index > 0
        assert result.uncalibrated is False

    def test_ml_engineer_all_skills_demonstrated(self):
        """All required skills with Demonstrated evidence (e=0.85)."""
        from app.scoring.readiness import compute_readiness
        required = [
            make_required("esco:ml",     "Machine Learning", 3),
            make_required("esco:python", "Python",           3),
            make_required("esco:dl",     "Deep Learning",    2),
        ]
        candidates = [
            make_candidate("esco:ml",     1.0, 2),  # Demonstrated
            make_candidate("esco:python", 1.0, 2),
            make_candidate("esco:dl",     1.0, 2),
        ]
        result = compute_readiness(candidates, required)
        # All s=1.0, e=0.85 → readiness = 85
        assert result.readiness_index == 85

    def test_uncalibrated_flag_propagates(self):
        """If any skill used a semantic (uncalibrated) match, result.uncalibrated=True."""
        from app.scoring.readiness import compute_readiness
        candidates = [
            make_candidate("esco:python", 1.0,  3, uncalibrated=False),
            make_candidate("esco:ml",     0.92, 2, uncalibrated=True),  # semantic
        ]
        required = [
            make_required("esco:python", "Python",           2),
            make_required("esco:ml",     "Machine Learning", 2),
        ]
        result = compute_readiness(candidates, required)
        assert result.uncalibrated is True

    def test_readiness_is_integer(self):
        """Readiness Index must always be an integer (rounded)."""
        from app.scoring.readiness import compute_readiness
        candidates = [make_candidate("A", 0.85, 2)]
        required  = [make_required("A", "A", 1)]
        result = compute_readiness(candidates, required)
        assert isinstance(result.readiness_index, int)

    def test_absent_skill_contributes_zero(self):
        """Absent evidence (level 0) → e=0 → contribution=0 regardless of s."""
        from app.scoring.readiness import compute_readiness
        candidates = [make_candidate("A", 1.0, 0)]  # Absent
        required  = [make_required("A", "A", 3)]
        result = compute_readiness(candidates, required)
        assert result.readiness_index == 0

    def test_skills_list_contains_all_required(self):
        """The skills list in the result must have one entry per required skill."""
        from app.scoring.readiness import compute_readiness
        required = [
            make_required("A", "Skill A", 3),
            make_required("B", "Skill B", 2),
            make_required("C", "Skill C", 1),
        ]
        result = compute_readiness([], required)
        assert len(result.skills) == 3
        uris = {s.esco_uri for s in result.skills}
        assert uris == {"A", "B", "C"}

    def test_contribution_equals_s_times_e_times_w(self):
        """Each skill.contribution == s * e * w."""
        from app.scoring.readiness import compute_readiness
        candidates = [make_candidate("A", 0.85, 2)]  # s=0.85, e=0.85, w=2
        required  = [make_required("A", "A", 2)]
        result = compute_readiness(candidates, required)
        skill = result.skills[0]
        expected_contrib = round(0.85 * 0.85 * 2, 4)
        assert abs(skill.contribution - expected_contrib) < 1e-3


# ── 2. Gap severity — all branches ───────────────────────────────────────────

class TestGapSeverityBranches:

    def _compute_gap_for(self, weight, s, e):
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps
        candidates = [make_candidate("X", s, self._e_to_level(e))]
        required   = [make_required("X", "X", weight)]
        r = compute_readiness(candidates, required)
        gaps = build_gaps(r, [])
        return gaps[0] if gaps else None

    def _e_to_level(self, e_float):
        # Approximate: maps multiplier back to nearest level
        if e_float >= 1.0:   return 3
        if e_float >= 0.85:  return 2
        if e_float >= 0.6:   return 1
        return 0

    def test_high_severity_weight3_se_below_half(self):
        from app.scoring.gap import classify_severity
        # w=3, s*e=0.0 → High
        assert classify_severity(3, 0.0, 0.0) == "High"
        assert classify_severity(3, 0.6, 0.5) == "High"  # 0.6*0.5=0.30

    def test_medium_severity_weight2_se_below_half(self):
        from app.scoring.gap import classify_severity
        assert classify_severity(2, 0.4, 1.0) == "Medium"  # s*e=0.4

    def test_medium_severity_weight3_se_between_half_and_085(self):
        from app.scoring.gap import classify_severity
        assert classify_severity(3, 0.7, 0.85) == "Medium"  # s*e=0.595

    def test_low_severity_weight1(self):
        from app.scoring.gap import classify_severity
        assert classify_severity(1, 0.5, 1.0) == "Low"   # w=1, s*e=0.5

    def test_no_gap_perfect_score(self):
        from app.scoring.gap import classify_severity
        assert classify_severity(3, 1.0, 1.0) is None

    def test_gaps_sorted_high_medium_low(self):
        """Returned gaps must be ordered High → Medium → Low."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps
        required = [
            make_required("H", "High Skill",   3),
            make_required("L", "Low Skill",    1),
            make_required("M", "Medium Skill", 2),
        ]
        r = compute_readiness([], required)
        gaps = build_gaps(r, [])
        severities = [g.severity for g in gaps]
        # High must come before any Medium, Medium before Low
        assert severities[0] == "High"
        if "Medium" in severities and "Low" in severities:
            med_idx = severities.index("Medium")
            low_idx = severities.index("Low")
            assert med_idx < low_idx

    def test_no_gap_when_all_verified(self):
        """All skills Verified and exact match → no gaps."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps
        candidates = [
            make_candidate("A", 1.0, 3),
            make_candidate("B", 1.0, 3),
        ]
        required = [
            make_required("A", "A", 3),
            make_required("B", "B", 2),
        ]
        r = compute_readiness(candidates, required)
        gaps = build_gaps(r, [])
        assert gaps == []

    def test_gap_recommendation_defaults_to_course(self):
        """When no learning step is provided for a gap, default to 'course'."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps
        r = compute_readiness([], [make_required("X", "X", 3)])
        gaps = build_gaps(r, [])
        assert gaps[0].recommendation["type"] == "course"

    def test_gap_recommendation_uses_seed_step(self):
        """When a learning step is provided, use it."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps
        required = [make_required("esco:python", "Python", 3)]
        r = compute_readiness([], required)
        steps = [make_step("esco:python", "project", "Build a Python project", 4, 1)]
        gaps = build_gaps(r, steps)
        assert len(gaps) == 1
        assert gaps[0].recommendation["type"] == "project"
        assert gaps[0].recommendation["title"] == "Build a Python project"
        assert gaps[0].recommendation["effortWeeks"] == 4


# ── 3. Projected Readiness — top-3 selection and gain ────────────────────────

class TestProjectedReadiness:

    def test_top_3_at_most(self):
        """Even with many gaps, only 3 steps are included in the projection."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [make_required(f"S{i}", f"Skill {i}", 3) for i in range(8)]
        r = compute_readiness([], required)
        gaps = build_gaps(r, [])
        proj = compute_projected_readiness(gaps, r, required)
        assert len(proj.top_steps) <= 3

    def test_projected_gte_current(self):
        """Projected readiness is always ≥ current readiness."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [
            make_required("A", "A", 3),
            make_required("B", "B", 2),
        ]
        candidates = [make_candidate("A", 1.0, 1)]  # Claimed
        r = compute_readiness(candidates, required)
        steps = [
            make_step("A", "course", "Learn A", 4, 1),
            make_step("B", "course", "Learn B", 4, 2),
        ]
        gaps = build_gaps(r, steps)
        proj = compute_projected_readiness(gaps, r, required)
        assert proj.projected_readiness >= proj.current_readiness

    def test_projection_uses_only_required_skills(self):
        """Steps that don't map to a required skill must not add points."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [make_required("A", "A", 3)]
        r = compute_readiness([], required)
        # Gap exists for A
        gaps = build_gaps(r, [make_step("A", "course", "Learn A", 4, 1)])
        # No "phantom" skills should be added
        proj = compute_projected_readiness(gaps, r, required)
        assert proj.projected_readiness <= 100

    def test_disclaimer_text_present(self):
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        r = compute_readiness([], [make_required("X", "X", 1)])
        gaps = build_gaps(r, [])
        proj = compute_projected_readiness(gaps, r, [make_required("X", "X", 1)])
        assert "Estimated" in proj.disclaimer
        assert "predict" in proj.disclaimer.lower()
        assert "not" in proj.disclaimer.lower()

    def test_gain_delta_nonnegative(self):
        """Each top step's gainDelta must be ≥ 0."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [make_required("A", "A", 3)]
        candidates = [make_candidate("A", 1.0, 1)]  # Claimed → can upgrade
        r = compute_readiness(candidates, required)
        steps = [make_step("A", "course", "Course A", 4, 1)]
        gaps = build_gaps(r, steps)
        proj = compute_projected_readiness(gaps, r, required)
        for step in proj.top_steps:
            assert step["gainDelta"] >= 0

    def test_gain_per_effort_week_positive(self):
        """Each step's gainPerEffortWeek must be > 0 (effort ≥ 1)."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [make_required("A", "A", 3)]
        candidates = [make_candidate("A", 1.0, 1)]
        r = compute_readiness(candidates, required)
        gaps = build_gaps(r, [make_step("A", "course", "C", 4, 1)])
        proj = compute_projected_readiness(gaps, r, required)
        for step in proj.top_steps:
            assert step["gainPerEffortWeek"] > 0

    def test_steps_ranked_by_gain_per_week(self):
        """Steps are ranked highest gain-per-week first."""
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        # Two equally-gapped skills; one step has much lower effort → higher gain/week
        required = [
            make_required("A", "A", 3),
            make_required("B", "B", 3),
        ]
        r = compute_readiness([], required)
        steps = [
            make_step("A", "course", "Course A", 2, 1),   # effort=2 → higher gain/wk
            make_step("B", "course", "Course B", 10, 2),  # effort=10 → lower gain/wk
        ]
        gaps = build_gaps(r, steps)
        proj = compute_projected_readiness(gaps, r, required)
        if len(proj.top_steps) >= 2:
            assert (
                proj.top_steps[0]["gainPerEffortWeek"]
                >= proj.top_steps[1]["gainPerEffortWeek"]
            )

    def test_projection_never_exceeds_100(self):
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [make_required("A", "A", 1)]
        candidates = [make_candidate("A", 1.0, 3)]
        r = compute_readiness(candidates, required)
        gaps = build_gaps(r, [])
        proj = compute_projected_readiness(gaps, r, required)
        assert proj.projected_readiness <= 100


# ── 4. ESCO relations — transferable skills ───────────────────────────────────

class TestEscoRelations:

    def test_related_skills_returns_only_candidate_possessed(self):
        """get_related_skills must only return skills the candidate has."""
        from app.scoring.esco_relations import get_related_skills
        # Candidate has python but not data_analysis
        candidate_uris = {"esco:python"}
        related = get_related_skills("esco:ml", candidate_uris)
        # ML is related to python, data_analysis, dl
        # candidate only has python
        uris = [r["escoId"] for r in related]
        assert "esco:python" in uris
        assert "esco:data_analysis" not in uris
        assert "esco:dl" not in uris

    def test_no_related_skills_empty_candidate(self):
        from app.scoring.esco_relations import get_related_skills
        assert get_related_skills("esco:ml", set()) == []

    def test_unknown_skill_returns_empty(self):
        from app.scoring.esco_relations import get_related_skills
        result = get_related_skills("esco:nonexistent_skill", {"esco:python"})
        assert result == []

    def test_result_has_esco_id_and_label(self):
        from app.scoring.esco_relations import get_related_skills
        result = get_related_skills("esco:ml", {"esco:python", "esco:dl"})
        for item in result:
            assert "escoId" in item
            assert "label" in item
            assert isinstance(item["escoId"], str)
            assert isinstance(item["label"], str)

    def test_related_skills_deduplicated_in_panel(self):
        """
        Simulates what the gap router does: aggregating transferable skills
        across multiple gaps should deduplicate by escoId.
        """
        from app.scoring.esco_relations import get_related_skills
        # python appears as related for both ml and dl
        candidate_uris = {"esco:python"}
        related_ml = get_related_skills("esco:ml", candidate_uris)
        related_dl = get_related_skills("esco:dl", candidate_uris)

        panel: dict = {}
        for r in related_ml + related_dl:
            panel[r["escoId"]] = r

        # python should appear only once even if it's related to both ml and dl
        assert list(panel.keys()).count("esco:python") == 1


# ── 5. Match router response shape (unit-level, no DB) ───────────────────────

class TestMatchResponseShape:

    def test_readiness_result_has_all_fields(self):
        from app.scoring.readiness import compute_readiness
        candidates = [make_candidate("esco:python", 1.0, 3)]
        required   = [make_required("esco:python", "Python", 3)]
        result = compute_readiness(candidates, required)
        assert hasattr(result, "readiness_index")
        assert hasattr(result, "skills")
        assert hasattr(result, "uncalibrated")
        assert hasattr(result, "total_weight")
        assert hasattr(result, "weighted_score_sum")

    def test_skill_score_has_all_fields(self):
        from app.scoring.readiness import compute_readiness
        candidates = [make_candidate("esco:python", 1.0, 2, source_snippet="Built a REST API")]
        required   = [make_required("esco:python", "Python", 3)]
        result = compute_readiness(candidates, required)
        skill = result.skills[0]
        assert skill.esco_uri == "esco:python"
        assert skill.esco_label == "Python"
        assert skill.weight == 3
        assert skill.s == 1.0
        assert 0 <= skill.e <= 1
        assert skill.source_snippet == "Built a REST API"


# ── 6. Gap response shape ─────────────────────────────────────────────────────

class TestGapResponseShape:

    def test_gap_has_required_fields(self):
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, Gap
        required = [make_required("esco:python", "Python", 3)]
        r = compute_readiness([], required)
        gaps = build_gaps(r, [make_step("esco:python", "course", "Python Course", 4, 1)])
        assert len(gaps) == 1
        g = gaps[0]
        assert hasattr(g, "esco_uri")
        assert hasattr(g, "esco_label")
        assert hasattr(g, "severity")
        assert hasattr(g, "weight")
        assert hasattr(g, "s")
        assert hasattr(g, "e")
        assert hasattr(g, "current_se")
        assert hasattr(g, "evidence_level")
        assert hasattr(g, "recommendation")
        assert isinstance(g.recommendation, dict)

    def test_recommendation_has_required_fields(self):
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps
        required = [make_required("X", "X", 3)]
        r = compute_readiness([], required)
        gaps = build_gaps(r, [make_step("X", "certification", "Cert X", 6, 1)])
        rec = gaps[0].recommendation
        assert "type" in rec
        assert "title" in rec
        assert "effortWeeks" in rec
        assert "targetEvidenceLevel" in rec
        assert "stepOrder" in rec
        assert rec["type"] == "certification"

    def test_projected_readiness_has_required_fields(self):
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        required = [make_required("A", "A", 3)]
        r = compute_readiness([], required)
        gaps = build_gaps(r, [make_step("A", "course", "C", 4, 1)])
        proj = compute_projected_readiness(gaps, r, required)
        assert hasattr(proj, "current_readiness")
        assert hasattr(proj, "projected_readiness")
        assert hasattr(proj, "top_steps")
        assert hasattr(proj, "uncalibrated")
        assert hasattr(proj, "disclaimer")


# ── 7. End-to-end scoring scenario — Machine Learning Engineer ────────────────

class TestMLEngineerScenario:
    """
    Full scenario: candidate has Python (Verified), ML (Demonstrated),
    but is missing Deep Learning, SQL, and Git.
    Job: ML Engineer (from jobs_seed.py).
    """

    def setup_method(self):
        self.required = [
            make_required("esco:ml",     "Machine Learning", 3),
            make_required("esco:python", "Python",           3),
            make_required("esco:dl",     "Deep Learning",    2),
            make_required("esco:sql",    "SQL",              2),
            make_required("esco:git",    "Git",              1),
        ]
        self.candidates = [
            make_candidate("esco:python", 1.0, 3),  # Verified exact match
            make_candidate("esco:ml",     1.0, 2),  # Demonstrated exact match
        ]
        self.steps = [
            make_step("esco:ml",     "course",  "ML Fundamentals",            6, 1),
            make_step("esco:dl",     "course",  "Deep Learning Specialization", 8, 2),
            make_step("esco:python", "project", "ML Project on GitHub",       4, 3),
        ]

    def test_readiness_calculation(self):
        from app.scoring.readiness import compute_readiness
        # Python: s=1.0, e=1.0, w=3 → 3.0
        # ML:     s=1.0, e=0.85, w=3 → 2.55
        # DL, SQL, Git: missing → 0
        # Σw = 3+3+2+2+1 = 11
        # Readiness = 100 * (3.0 + 2.55) / 11 = 100 * 5.55 / 11 ≈ 50.45 → 50
        result = compute_readiness(self.candidates, self.required)
        expected = round(100 * (3.0 + 2.55) / 11)
        assert result.readiness_index == expected

    def test_gaps_identified_correctly(self):
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps
        r = compute_readiness(self.candidates, self.required)
        gaps = build_gaps(r, self.steps)
        gap_uris = {g.esco_uri for g in gaps}
        # ML has Demonstrated (e=0.85) and s=1.0 → s*e=0.85 < 1.0 but ≥ 0.5
        # → Medium (w=3, 0.5 ≤ s*e < 0.85)
        assert "esco:dl"  in gap_uris
        assert "esco:sql" in gap_uris
        assert "esco:git" in gap_uris
        # Python is Verified → no gap
        assert "esco:python" not in gap_uris

    def test_projection_improves_readiness(self):
        """
        Projection improves readiness when candidate has Claimed evidence (e=0.6)
        for the gapped skills, and the step upgrades them to Demonstrated (e=0.85).
        """
        from app.scoring.readiness import compute_readiness
        from app.scoring.gap import build_gaps, compute_projected_readiness
        # Use candidates with Claimed evidence for DL so the course upgrade applies
        candidates_with_claimed = self.candidates + [
            make_candidate("esco:dl", 1.0, 1),  # Claimed — course upgrades to Demonstrated
        ]
        r = compute_readiness(candidates_with_claimed, self.required)
        gaps = build_gaps(r, self.steps)
        proj = compute_projected_readiness(gaps, r, self.required)
        # DL gap: Claimed→Demonstrated via course → gain > 0
        assert proj.projected_readiness >= proj.current_readiness

    def test_transferable_skills_from_ml(self):
        """ML is related to python, dl, data_analysis — candidate has Python and ML."""
        from app.scoring.esco_relations import get_related_skills
        candidate_uris = {c["esco_uri"] for c in self.candidates}
        # For the DL gap, ML is a related skill the candidate has
        related_for_dl = get_related_skills("esco:dl", candidate_uris)
        labels = [r["label"] for r in related_for_dl]
        # Candidate has ML (esco:ml), which is listed as related to DL
        assert any("machine learning" in l.lower() or "ml" in l.lower() for l in labels)
