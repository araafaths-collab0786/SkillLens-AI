"""
ESCO Skills loader — apps/api/app/nlp/esco_loader.py

Loads the ESCO occupations/skills CSV (bundled at /data/esco/skills.csv),
builds a normalized alias index (canonical label + synonyms + abbreviations),
and exposes lookup helpers.

CSV format expected (ESCO v1.1 skills export):
  conceptUri, preferredLabel, altLabels, description, skillType

If the CSV is absent, falls back to a bundled minimal seed so the API starts.
"""

import csv
import logging
import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Iterator

logger = logging.getLogger(__name__)

# Resolve data directory relative to this file
_REPO_ROOT = Path(__file__).resolve().parents[4]  # …/SkillLens-AI
_ESCO_CSV = _REPO_ROOT / "data" / "esco" / "skills.csv"

# ── Common abbreviation expansions ────────────────────────────────────────────
# Maps lower-cased abbreviation → canonical phrase for normalization.
# Extend this list as needed.
ABBREVIATIONS: dict[str, str] = {
    "ml":   "machine learning",
    "ai":   "artificial intelligence",
    "dl":   "deep learning",
    "nlp":  "natural language processing",
    "cv":   "computer vision",
    "k8s":  "kubernetes",
    "tf":   "tensorflow",
    "js":   "javascript",
    "ts":   "typescript",
    "py":   "python",
    "sql":  "structured query language",
    "oop":  "object-oriented programming",
    "rest": "representational state transfer",
    "api":  "application programming interface",
    "ci":   "continuous integration",
    "cd":   "continuous delivery",
    "iac":  "infrastructure as code",
    "aws":  "amazon web services",
    "gcp":  "google cloud platform",
    "ui":   "user interface",
    "ux":   "user experience",
}


@dataclass
class EscoSkill:
    uri: str
    label: str                  # canonical preferred label (lower-cased)
    label_display: str          # original casing for display
    alt_labels: list[str]       # lower-cased alternative labels
    skill_type: str             # "skill/competence" | "knowledge" | "attitude"


@dataclass
class AliasIndex:
    """
    Maps every known alias (lower-cased, normalized) → EscoSkill.
    Used for O(1) exact lookup before falling back to semantic search.
    """
    _index: dict[str, EscoSkill] = field(default_factory=dict)
    skills: list[EscoSkill] = field(default_factory=list)

    def add(self, skill: EscoSkill) -> None:
        self.skills.append(skill)
        # Index canonical label
        self._index[_normalize(skill.label)] = skill
        self._index[skill.label] = skill
        # Index all alt labels
        for alt in skill.alt_labels:
            self._index[_normalize(alt)] = skill
        # Index abbreviation expansions for canonical label
        abbr_expansion = ABBREVIATIONS.get(_normalize(skill.label))
        if abbr_expansion:
            self._index[_normalize(abbr_expansion)] = skill

    def lookup(self, text: str) -> EscoSkill | None:
        """Exact alias lookup. Returns None if not found."""
        key = _normalize(text)
        # Direct match
        if key in self._index:
            return self._index[key]
        # Abbreviation expansion
        expanded = ABBREVIATIONS.get(key)
        if expanded:
            return self._index.get(_normalize(expanded))
        return None

    def __len__(self) -> int:
        return len(self.skills)


def _normalize(text: str) -> str:
    """Lower-case, strip punctuation, collapse whitespace."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _split_alt_labels(raw: str) -> list[str]:
    """Split ESCO alt_labels field (newline or pipe separated)."""
    if not raw:
        return []
    parts = re.split(r"[\n|]", raw)
    return [p.strip().lower() for p in parts if p.strip()]


@lru_cache(maxsize=1)
def load_esco_index() -> AliasIndex:
    """
    Load the ESCO skills CSV and build the alias index.
    Result is cached for the lifetime of the process.
    """
    index = AliasIndex()

    if _ESCO_CSV.exists():
        try:
            with open(_ESCO_CSV, encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    uri = row.get("conceptUri", "").strip()
                    preferred = row.get("preferredLabel", "").strip()
                    alt_raw = row.get("altLabels", "")
                    skill_type = row.get("skillType", "skill/competence").strip()
                    if not preferred:
                        continue
                    skill = EscoSkill(
                        uri=uri,
                        label=preferred.lower(),
                        label_display=preferred,
                        alt_labels=_split_alt_labels(alt_raw),
                        skill_type=skill_type,
                    )
                    index.add(skill)
            logger.info("ESCO index loaded: %d skills from CSV", len(index))
        except Exception as e:
            logger.warning("Failed to load ESCO CSV: %s. Using seed data.", e)
            _load_seed(index)
    else:
        logger.info("ESCO CSV not found at %s. Using seed data.", _ESCO_CSV)
        _load_seed(index)

    return index


def _load_seed(index: AliasIndex) -> None:
    """Minimal seed data — used when the full ESCO CSV is absent."""
    SEED: list[tuple[str, str, list[str]]] = [
        ("esco:python",         "Python",              ["python programming", "python language", "py"]),
        ("esco:javascript",     "JavaScript",          ["js", "ecmascript", "node.js", "nodejs"]),
        ("esco:typescript",     "TypeScript",          ["ts"]),
        ("esco:java",           "Java",                ["java programming", "java se", "java ee"]),
        ("esco:sql",            "SQL",                 ["structured query language", "mysql", "postgresql", "sqlite"]),
        ("esco:ml",             "machine learning",    ["ml", "statistical learning"]),
        ("esco:dl",             "deep learning",       ["dl", "neural networks", "ann", "cnn", "rnn"]),
        ("esco:nlp",            "natural language processing", ["nlp", "text mining"]),
        ("esco:cv",             "computer vision",     ["cv", "image processing", "opencv"]),
        ("esco:docker",         "Docker",              ["containerisation", "containerization"]),
        ("esco:kubernetes",     "Kubernetes",          ["k8s", "container orchestration"]),
        ("esco:git",            "Git",                 ["version control", "github", "gitlab"]),
        ("esco:react",          "React",               ["react.js", "reactjs"]),
        ("esco:fastapi",        "FastAPI",             ["fast api"]),
        ("esco:data_analysis",  "data analysis",       ["data analytics", "exploratory data analysis", "eda"]),
        ("esco:communication",  "communication",       ["verbal communication", "written communication"]),
        ("esco:teamwork",       "teamwork",            ["collaboration", "team collaboration"]),
        ("esco:project_mgmt",   "project management",  ["project planning", "agile", "scrum"]),
        ("esco:problem_solving","problem solving",     ["analytical thinking", "critical thinking"]),
        ("esco:tensorflow",     "TensorFlow",          ["tf", "tensorflow 2"]),
        ("esco:pytorch",        "PyTorch",             ["torch"]),
        ("esco:aws",            "Amazon Web Services", ["aws", "amazon cloud"]),
        ("esco:azure",          "Microsoft Azure",     ["azure"]),
    ]
    for uri, label, alts in SEED:
        skill = EscoSkill(
            uri=uri,
            label=label.lower(),
            label_display=label,
            alt_labels=[a.lower() for a in alts],
            skill_type="skill/competence",
        )
        index.add(skill)
    logger.info("ESCO seed loaded: %d skills", len(index))
