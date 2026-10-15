# SkillLens AI

> **AICTE IBM SkillsBuild Machine Learning & Applied AI Internship Program 2026**
> Capstone Project | SDG 8 — Decent Work and Economic Growth

---

## Contents

1. [Problem Statement](#1-problem-statement)
2. [SDG 8 Alignment](#2-sdg-8-alignment)
3. [Architecture](#3-architecture)
4. [Repository Structure](#4-repository-structure)
5. [Tech Stack](#5-tech-stack)
6. [Design System](#6-design-system)
7. [Scoring Methodology](#7-scoring-methodology)
8. [Security & Privacy](#8-security--privacy)
9. [Device Support Matrix](#9-device-support-matrix)
10. [Setup & Running Locally](#10-setup--running-locally)
11. [Demo Scenario](#11-demo-scenario)
12. [Calibration Status & Limitations](#12-calibration-status--limitations)
13. [Decision Log](#13-decision-log)
14. [Phase Progress](#14-phase-progress)
15. [Screenshots](#15-screenshots)

---

## 1. Problem Statement

Millions of job seekers — especially first-generation graduates, rural youth,
and career switchers — are overlooked not because they lack ability but because
their skills are invisible to hiring systems:

- **Unverifiable claims.** Resumes list skills that recruiters cannot check,
  while ATS keyword filters reject candidates who phrase the same skill
  differently ("ML" vs. "machine learning", "k8s" vs. "Kubernetes").
- **No actionable feedback.** Candidates don't learn which specific skills
  separate them from a target role or what to learn next, so they apply blindly.
- **Paper credentials excluded.** Candidates in semi-urban and rural areas
  often hold only printed resumes and certificates that digital tools cannot
  process.

SkillLens AI normalizes skills to a standard taxonomy (ESCO), screens document
quality, measures the gap between a candidate's evidenced profile and a target
job, and recommends a concrete, prioritized learning path.

---

## 2. SDG 8 Alignment

**Goal 8 — Decent Work and Economic Growth**

| Target | How SkillLens AI contributes |
|--------|------------------------------|
| 8.5 — Full and productive employment | Reduces information asymmetry between job seekers and employers by making skills explicit and comparable. |
| 8.6 — Youth employment and training | Provides first-generation and rural youth with actionable skill-gap feedback they previously had no access to. |
| 8.8 — Safe and secure working environments | Promotes skills-based hiring, reducing credentialism and widening access. |
| 8.b — Employment strategy development | Open taxonomy (ESCO) and open methodology support policy-level skills mapping. |

**Official SDG 8 targets:** https://sdgs.un.org/goals/goal8

---

## 3. Architecture

```mermaid
graph TD
    subgraph Client["Browser / Mobile App"]
        direction TB
        FE["Next.js Frontend\nApp Router · React · TypeScript"]
        IDB["IndexedDB Queue\n(idb) — offline capture"]
    end

    subgraph API["FastAPI Backend (Python 3.11+)"]
        direction TB
        AUTH["auth/\nJWT · bcrypt · CSRF\nrefresh-token rotation"]
        RESUME["resumes/\nupload · camera capture\nidempotency · rate-limit"]
        PIPELINE["verification/\nquality_check · document_detect\nperspective · enhance\nauthenticity · ocr"]
        NLP["nlp/\nesco_loader · parser\nsemantic_matcher"]
        SCORING["scoring/\nreadiness · gap\neso_relations · calibration"]
        JOBS["jobs/ · match/ · gap-analysis/\ndashboard/"]
    end

    subgraph DB["MongoDB 7"]
        USERS[("users")]
        RESUMES_C[("resumes")]
        JOBS_C[("jobs")]
        MATCHES_C[("matches")]
        GAPS_C[("gap_analyses")]
        TOKENS[("refresh_tokens")]
    end

    FE -->|"REST JSON\nhttpOnly cookies\nCSRF header"| AUTH
    FE --> RESUME
    FE --> JOBS
    IDB -->|"sync on reconnect\nexponential backoff"| RESUME

    RESUME --> PIPELINE
    PIPELINE -->|"extracted text"| NLP
    NLP --> SCORING

    AUTH --> USERS
    AUTH --> TOKENS
    RESUME --> RESUMES_C
    JOBS --> JOBS_C
    SCORING --> MATCHES_C
    SCORING --> GAPS_C

    style Client fill:#f3f6f8,stroke:#e5e7eb
    style API fill:#eef2ff,stroke:#c7d2fe
    style DB fill:#f0fdf4,stroke:#bbf7d0
```

### Data Flow — Resume to Readiness Index

```mermaid
sequenceDiagram
    actor C as Candidate
    participant FE as Next.js
    participant API as FastAPI
    participant DB as MongoDB

    C->>FE: Upload PDF or capture with camera
    FE->>API: POST /api/v1/resumes
    API->>API: validate (magic bytes, size, dimensions)
    API->>API: screening pipeline (quality → detect → perspective → enhance → authenticity → OCR)
    API->>API: NLP (ESCO alias lookup → semantic match → evidence scoring)
    API->>DB: save resume + skills
    API-->>FE: screening report + parsed skills

    C->>FE: Select target job
    FE->>API: POST /api/v1/match {resume_id, job_id}
    API->>DB: load resume skills + job weights
    API->>API: compute Readiness Index (Σ s·e·w / Σw × 100)
    API->>DB: persist match result
    API-->>FE: readiness_index + per-skill breakdown

    C->>FE: View gap analysis
    FE->>API: POST /api/v1/gap-analysis {resume_id, job_id}
    API->>API: classify gaps (High/Medium/Low)
    API->>API: compute projected readiness (top 3 steps)
    API->>API: look up transferable skills (ESCO relations)
    API->>DB: persist gap analysis
    API-->>FE: gaps + learning path + projected readiness
```

---

## 4. Repository Structure

```
SkillLens-AI/
├── apps/
│   ├── web/                     Next.js frontend (TypeScript, App Router)
│   │   └── src/
│   │       ├── app/             Routes: / · /login · /dashboard · /resume
│   │       │                           /match · /gap-analysis
│   │       ├── components/      Navbar · RadialGauge · SkillTable · GapCard
│   │       │                    LearningTimeline · Toast · ErrorBoundary
│   │       │                    CropOverlay · ScorePreview · PasswordStrength
│   │       ├── hooks/           useDocumentCamera · useOfflineSync
│   │       ├── content/         landing.ts (all copy)
│   │       └── lib/             cn · offlineQueue (IndexedDB)
│   │
│   └── api/                     FastAPI backend (Python 3.11+)
│       └── app/
│           ├── main.py          Application entry point
│           ├── config.py        Pydantic Settings
│           ├── routers/         auth · resumes · jobs · match · dashboard
│           ├── verification/    quality_check · document_detect · perspective
│           │                    enhance · authenticity · ocr · upload_validation
│           ├── nlp/             esco_loader · parser · semantic_matcher
│           ├── scoring/         readiness · gap · esco_relations
│           │                    constants · calibration
│           ├── data/            jobs_seed.py (20 roles)
│           ├── models/          envelope · auth
│           └── db/              connection · indexes
│
├── packages/
│   └── shared/                  Shared TypeScript types, Zod schemas, API client
│       └── src/
│           ├── schemas.ts       Domain types + Zod validators
│           ├── api-client.ts    Typed fetch wrapper (authApi · resumeApi · jobsApi
│           │                     matchApi · dashboardApi)
│           ├── api-envelope.ts  ApiEnvelope<T>
│           └── design-tokens.ts Color palette · spacing · motion · contrast pairs
│
├── data/
│   ├── esco/                    ESCO skills CSV (bundled)
│   └── validation/              Labeled pairs for calibration (Gate 3, pending)
│
├── infra/
│   ├── docker-compose.yml       One-command startup (mongo + api + web)
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── mongo-init.js
│
├── scripts/
│   ├── seed.py                  Seeds 20 jobs + demo user → MongoDB
│   ├── check-contrast.ts        WCAG 2.x automated contrast checker
│   └── tsconfig.json
│
├── tests/
│   ├── api/
│   │   ├── test_auth.py         Auth: register · login · rate-limit · refresh rotation
│   │   ├── test_scoring.py      Scoring: readiness · gaps · projection · ESCO
│   │   ├── test_match_gap.py    Match + gap endpoints: 38 tests
│   │   └── test_screening.py    Screening pipeline (skipped without OpenCV)
│   ├── e2e.spec.ts              Playwright: landing · login · viewport matrix
│   └── overflow-check.spec.ts   Horizontal overflow check at 320 px
│
├── .env.example                 Environment variable template
├── gitignore.txt
└── README.md                    This file
```

---

## 5. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router), React, TypeScript | 14 / 18 / 5 |
| Styling | Tailwind CSS, Framer Motion | 3 / 11 |
| Forms | React Hook Form + Zod | — |
| Icons | Lucide React | — |
| Offline queue | idb (IndexedDB wrapper) | — |
| Backend | Python, FastAPI, Pydantic v2 | 3.11+ / 0.14+ / 2 |
| Computer vision | OpenCV (`opencv-python`) | 4.x |
| OCR | pytesseract | — |
| Duplicate detection | imagehash | — |
| PDF handling | PyMuPDF | — |
| NLP | spaCy (`en_core_web_sm`) | 3.x |
| Semantic matching | sentence-transformers (`all-MiniLM-L6-v2`) | — |
| Auth | bcrypt, python-jose (JWT) | — |
| Database | MongoDB | 7 |
| DB driver | PyMongo Async (`AsyncMongoClient`) | ≥ 4.9.2 |
| Infra | Docker Compose | v2 |
| Tests | pytest, Playwright | — |

---

## 6. Design System

### Colour Palette

| Token | Hex | Status | Approved Use |
|-------|-----|--------|--------------|
| White Mist | `#F3F6F8` | ✅ Approved | Primary page background |
| Deep Navy | `#0B1F3A` | ✅ Approved | Text only — headings, body, labels, text on Cyan buttons |
| Cyan | `#06B6D4` | ✅ Approved | Fills and accents — button backgrounds, progress fills, large icons |
| Cyan Text | `#0E7490` | ✅ Approved (Gate 2, 2025-07-11) | Links, small accent text, focus rings on White Mist — 4.94:1 contrast |

**Blocked combinations (must never appear in components):**
- White `#FFFFFF` on Cyan `#06B6D4` — contrast ~2.4:1, below 4.5:1 required.
- Cyan `#06B6D4` as text on White Mist `#F3F6F8` — contrast ~2.2:1, below 4.5:1 required.
- Cyan `#06B6D4` as an essential UI boundary — contrast ~2.2:1, below 3.0:1 required. Decorative fills only.

### Contrast CI Check

```
PASS  deep-navy-on-white-mist       15.22:1  (≥ 4.5 required)
PASS  deep-navy-on-cyan              6.80:1  (≥ 4.5 required)
PASS  deep-navy-on-cyan-large        6.80:1  (≥ 3.0 required)
BLOCKED-OK  white-on-cyan-BLOCKED    2.43:1  (correctly fails — blocked combination)
BLOCKED-OK  cyan-on-white-mist-BLOCKED  2.24:1  (correctly fails — blocked for text)
PASS  deep-navy-focus               15.22:1  (≥ 3.0 required for focus ring)
WARN  cyan-border-on-white-mist      2.24:1  (not enforced — decorative fills only)
PASS  cyan-text-on-white-mist        4.94:1  (≥ 4.5 required)
PASS  cyan-text-focus                4.94:1  (≥ 3.0 required for focus ring)
CI: ✅ PASSED  6 pass · 0 fail · 1 warn (decorative) · 2 blocked-ok
```

Run manually:
```bash
cd apps/web && npm run check-contrast
```

### Spacing

8 px grid. All spacing values are multiples of 8 px.

### Motion

- Transitions: 200–300 ms ease-out on hover and focus.
- Page load: staggered fade-up with 80 ms stagger.
- `prefers-reduced-motion`: all non-essential animation disabled.

### Accessibility

- WCAG AA throughout.
- Skip-to-content link on every page.
- ARIA labels on all camera controls.
- `alt` on all images.
- Visible focus ring on every interactive element.
- Touch targets ≥ 44 × 44 px.

---

## 7. Scoring Methodology

> **UNCALIBRATED NOTICE:** Semantic match scores are uncalibrated until Gate 3
> (calibration dataset approval) is completed. Every API response that includes
> a semantic match carries `uncalibrated: true`. The UI labels all such scores
> "Uncalibrated similarity match." Do not interpret scores as measured accuracy.

### Evidence Levels

| Level | Value | Multiplier (e_i) | What it establishes |
|-------|-------|-------------------|---------------------|
| Verified | 3 | 1.0 | Supported by a checkable artifact (public repo URL resolves, or certificate ID passes format validation). Does **not** prove the document is authentic or that the person did the work. |
| Demonstrated | 2 | 0.85 | Project or experience entry describes the skill with a concrete, stated outcome. Self-described, not checked. |
| Claimed | 1 | 0.6 | Skill listed without supporting context. Self-described only. |
| Absent | 0 | 0.0 | No evidence found. |

### Semantic Match Strength (UNCALIBRATED)

For exact ESCO alias matches: `s_i = 1.0`.

For semantic matches via sentence-transformers (cosine similarity → s_i):

| Cosine range | s_i | Status |
|-------------|-----|--------|
| ≥ 0.92 | 0.95 | UNCALIBRATED |
| 0.85 – 0.92 | 0.85 | UNCALIBRATED |
| 0.78 – 0.85 | 0.70 | UNCALIBRATED |
| < 0.78 | 0.00 | No match |

These thresholds are **proposed and uncalibrated**. They must not be changed
without Gate 3 written approval and the held-out evaluation report.

### Readiness Index

```
Readiness = 100 × Σ_i (s_i × e_i × w_i) / Σ_i w_i
```

- Summed over all required skills for the target job.
- Result clamped to 0–100 and rounded to the nearest integer.
- `w_i` ∈ {1, 2, 3} per skill (job-defined weights: 1 = nice-to-have, 2 = important, 3 = critical).

**Worked example:**

| Skill | w | s | e | s·e·w |
|-------|---|---|---|-------|
| Python (Verified, exact) | 3 | 1.00 | 1.00 | 3.00 |
| Machine Learning (Demonstrated, exact) | 3 | 1.00 | 0.85 | 2.55 |
| Deep Learning (Absent) | 2 | 0.00 | 0.00 | 0.00 |
| SQL (Absent) | 2 | 0.00 | 0.00 | 0.00 |
| Git (Absent) | 1 | 0.00 | 0.00 | 0.00 |
| **Total** | **11** | | | **5.55** |

Readiness = 100 × 5.55 / 11 = **50**

### Gap Severity

| Severity | Condition |
|----------|-----------|
| High | w_i = 3 and s_i × e_i < 0.5 |
| Medium | w_i = 2 and s_i × e_i < 0.5, OR w_i = 3 and 0.5 ≤ s_i × e_i < 0.85 |
| Low | All other gaps where s_i × e_i < 1.0 |

### Projected Readiness (Estimate — Not a Guarantee)

The projection recomputes Readiness for the top 3 learning steps, applying the
following evidence upgrade rules:

| Step type | Evidence upgrade |
|-----------|-----------------|
| Course + certificate upload | Claimed → Demonstrated (e = 0.85), or → Verified (e = 1.0) only when certificate ID validates |
| Project + public repo URL | Demonstrated → Verified (e = 1.0) |
| Certification | → Verified (e = 1.0) once certificate ID validated |

Steps are ranked by projected gain (ΔReadiness) ÷ effort weeks.

**The projected readiness is an estimate. It assumes the steps are completed
and evidence is submitted and checked. It does not predict hiring outcomes.**

### Transferable Skills

Transferable skills are identified via ESCO skill relations (one-hop). They
appear **only** in the transferable-skills panel and do **not** contribute to
the Readiness Index. The current relation map is a seed-level approximation
(`apps/api/app/scoring/esco_relations.py`); full ESCO graph support is planned.

---

## 8. Security & Privacy

### Upload Validation (server-side)

- Magic-byte file signature check (not just MIME header or extension).
- Max 10 MB file size; max 4 000 × 4 000 px; max 16 MP; max 5 PDF pages.
- Rejects encrypted PDFs and PDFs with JavaScript or embedded executables.
- EXIF metadata stripped from stored images (including GPS data).
- Processing timeout: 20 seconds per document.
- Uploads stored outside the web root with randomized filenames.
- Temporary files deleted in a `finally` block; scheduled cleanup for orphans.
- Rate limit: 20 uploads per user per hour, and per IP.

### Data Retention

- Original files retained for 30 days (configurable `RESUME_RETENTION_DAYS`), then deleted automatically.
- Users can delete any resume and all its associated files from the dashboard.
- Users can delete their account; all personal data is removed.
- Resumes contain personal data. They are **not** used for training or analytics.
- Resume content is **never** sent to third-party services.
- Logs contain no resume text, file contents, or personal data.

### Authentication

- Passwords: bcrypt (rounds=12), minimum 12 characters, checked against a common-password list.
- JWT access token: 15-minute expiry, `httpOnly`, `Secure`, `SameSite=Lax` cookie.
- JWT refresh token: 7-day expiry, `httpOnly`, `Secure`, `SameSite=Strict` where the flow permits.
- Refresh token rotation: each `/refresh` issues a new token and invalidates the previous one.
- Token family IDs stored in MongoDB; reusing an old token revokes the entire family.
- CSRF: double-submit token (`X-CSRF-Token` header) verified server-side on all state-changing requests.
- CORS: strict allowlist (no wildcard origins with credentials).
- Login rate limit: 5 attempts per minute per IP and per account; generic error messages only.
- `?next=` redirect: allowlist of same-origin paths; absolute URLs, `//` prefixes, backslashes, and encoded variants are rejected.

### Development vs. Production

The setting `COOKIE_SECURE=false` is valid **only** when `APP_ENV=development`.
The application enforces this in `config.py` (`cookie_secure_effective` property).
**Never set `COOKIE_SECURE=false` in a production environment.**

---

## 9. Device Support Matrix

| Device class | Viewport | Layout | Status |
|-------------|----------|--------|--------|
| Small phone | 320–414 px | Single column | ✅ Implemented & tested |
| Large phone | 415–767 px | Single column | ✅ Implemented & tested |
| Tablet portrait | 768–1023 px | Two columns | ✅ Implemented & tested |
| Tablet landscape | 1024 × 768 | Two columns | ✅ Implemented & tested |
| Laptop | 1366 × 768 | Three-column grid | ✅ Implemented & tested |
| Desktop | 1920 × 1080 | Three-column grid | ✅ Implemented & tested |
| iOS Safari | Current | All viewports | ✅ Designed for; not device-tested |
| Chrome Android | Current | All viewports | ✅ Designed for; not device-tested |
| Firefox | Current | All viewports | ✅ Designed for; not device-tested |
| Edge | Current | All viewports | ✅ Designed for; not device-tested |

**Tested breakpoints (Playwright):** iPhone SE (375×667), Android (412×915),
Landscape phone (667×375), iPad portrait (768×1024), iPad landscape (1024×768),
Laptop (1366×768), Desktop (1920×1080).

**Horizontal overflow check:** passes at 320 px (automated, see `tests/overflow-check.spec.ts`).

Playwright viewport configuration: [`tests/playwright.config.ts`](tests/playwright.config.ts).

---

## 10. Setup & Running Locally

### Prerequisites

- Docker and Docker Compose v2
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)
- Tesseract OCR (for OCR features): `apt install tesseract-ocr` / `brew install tesseract`
- OpenCV system dependencies (for screening pipeline)

### One-command start (Docker)

```bash
cp .env.example .env
# Edit .env — set MONGO_ROOT_PASSWORD and JWT_SECRET at minimum
docker compose -f infra/docker-compose.yml up
```

Then seed the database:

```bash
# In a separate terminal, with MONGO_URI pointing to the running container:
export MONGO_URI=mongodb://skilllens:YOUR_PASSWORD@localhost:27017/skilllens?authSource=admin
python scripts/seed.py
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API health | http://localhost:8000/health |
| API docs (dev) | http://localhost:8000/docs |

### Local development (without Docker)

**API:**
```bash
cd apps/api
python -m venv .venv
# Windows: .venv\Scripts\activate | Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd apps/web
npm install
npm run dev
```

**Run tests (API):**
```bash
cd apps/api
# Run from the api directory so `app` is on sys.path
python -m pytest ../../tests/api/ -v
```

**Run contrast check:**
```bash
cd apps/web
npm run check-contrast
```

**Seed (local MongoDB required):**
```bash
export MONGO_URI=mongodb://localhost:27017/skilllens
python scripts/seed.py
```

---

## 11. Demo Scenario

After seeding (`python scripts/seed.py`):

**Demo user credentials:**
- Email: `demo@skilllens.ai`
- Password: `DemoPassword2026!`

**Full flow (phone and desktop viewports):**

1. Open `http://localhost:3000` — landing page with animated score preview.
2. Click **Get Started** → `/login`.
3. Sign in with the demo credentials.
4. **Dashboard** — time-of-day greeting, empty states with CTAs.
5. **Resume** → choose **Upload PDF / Image** or **Scan Hardcopy with Camera**.
   - Upload: select a PDF or image resume → progress stages → screening report + parsed skills.
   - Camera: allow camera access → position document → capture → adjust crop corners → submit.
   - Both end at the same results view.
6. **Match** (`/match?resumeId=<id>`) → search for "Machine Learning Engineer" → animated Readiness Index gauge appears.
7. Click **Analyze skill gaps** → `/gap-analysis`.
   - Gap cards sorted High → Medium → Low.
   - Transferable skills panel.
   - Learning-path timeline (horizontal on tablet+, vertical on phone).
   - Projected Readiness bar animates from current to projected (labeled **Estimated**).
8. **Dashboard** — Readiness Index card now shows the score; top 3 gaps and learning steps populated.

**Offline demo:**
1. Disable network (DevTools → Network → Offline).
2. Open `/resume` → Camera tab → capture an image.
3. The app saves to IndexedDB: *"Saved on this device. Will upload when online."*
4. Re-enable network.
5. The queue syncs automatically; a toast confirms success.

---

## 12. Calibration Status & Limitations

| Component | Status |
|-----------|--------|
| ESCO alias index (exact matching) | ✅ Built — seed data for 23 skills; full CSV supported if placed at `data/esco/skills.csv` |
| Semantic matching thresholds | ⚠️ **UNCALIBRATED** — proposed values, not validated on real data |
| Evidence scoring | ✅ Defined and formula-tested; not validated on real resumes |
| Readiness Index | ✅ Formula correct; accuracy depends on calibration |
| ESCO skill relations | ✅ Seed map (`scoring/esco_relations.py`); full ESCO graph not yet loaded |
| sentence-transformers model | ❌ Not loaded in current environment — semantic matching uses fallback `s=0` |
| spaCy NLP | ❌ Not installed in current environment — entity extraction uses heuristic fallback |
| OpenCV / pytesseract | ❌ Not installed in current environment — screening pipeline tests skipped |

**Accuracy on real, unseen resumes is unknown.**

The calibration harness (`scoring/calibration.py`) is implemented but blocked
pending Gate 3 approval of the labeled validation dataset specification.
Until then, every API response that touches a semantic match carries
`uncalibrated: true` and the UI labels those scores accordingly.

### Known Limitations

- **No real ESCO CSV:** The bundled seed covers 23 canonical skills. A full
  ESCO CSV (`data/esco/skills.csv`) will load automatically when present.
- **sentence-transformers requires a GPU or a capable CPU** for acceptable
  inference speed. The fallback (exact alias only) is deterministic but misses
  synonym matches beyond the alias list.
- **Camera capture requires HTTPS** in production browsers. Local development
  works over `http://localhost` (browsers special-case localhost).
- **Offline sync** works only in browsers that support IndexedDB (all modern browsers).
- **Projected Readiness** is an estimate, not a guarantee. It does not account
  for the quality of the course content, the candidate's learning pace, or
  changes in job requirements.
- **Document authenticity screening** is quality and risk flagging only. It
  cannot determine whether a document is genuine or fraudulent. Always requires
  human review for consequential decisions.

---

## 13. Decision Log

All approved choices are recorded here with the date and approver.

| # | Decision | Chosen | Date | Approver |
|---|----------|--------|------|----------|
| Gate 1 | MongoDB driver: Motor (deprecated) vs. PyMongo Async | **PyMongo Async** (`pymongo.AsyncMongoClient` ≥ 4.9.2) | 2025-07-11 | User |
| Gate 2 | Cyan Text `#0E7490` provisional palette token | **Approved** — 4.94:1 contrast on White Mist; approved for links, small accent text, and focus rings | 2025-07-11 | User |
| Gate 3 | Calibration dataset specification | **Deferred** — spec to be presented and approved before labeling begins; uncalibrated flag active until resolved | 2025-07-11 | User |

### Gate 1 — MongoDB Driver

**PyMongo Async** was selected over Motor because Motor is deprecated and
unmaintained since 2024, while PyMongo Async (`AsyncMongoClient`, added in
PyMongo 4.7, October 2023) is the official successor with active MongoDB, Inc.
support, an essentially identical API, and full security patch coverage.

---

## 14. Phase Progress

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Repo scaffold, docker-compose, shared types, design tokens + CI contrast check, responsive breakpoints, middleware, README skeleton | ✅ Complete |
| 2 | Landing + Login pages (responsive, all Section 4A viewports), auth API with hardening, route middleware, CSRF, pytest suite (register, login, rate-limit, refresh rotation, reuse detection, open-redirect rejection) | ✅ Complete |
| 3 | Resume intake API (both methods), upload validation (magic bytes, size, dimensions), screening pipeline (quality → detect → perspective → enhance → authenticity → OCR), /resume page (responsive, phone camera), useDocumentCamera.ts, offline queue (IndexedDB) | ✅ Complete |
| 4 | ESCO loader (alias index, abbreviations), NLP extraction, section-aware evidence scoring, 20-role job seed, scoring module (readiness, gap, projection), calibration harness (Gate 3 blocked), worked-example tests | ✅ Complete |
| 5 | Gap analyzer (severity classifier, projection, ESCO relations), match + gap endpoints, Match page (animated gauge, category chips, stacked-card skill table on phones), Gap Analysis page (severity sections, transferable panel, timeline), 38 tests | ✅ Complete |
| 6 | Full Dashboard (greeting, readiness card, top gaps, learning steps, submissions table / stacked cards), Toast notifications, ErrorBoundary, persist match/gap to MongoDB, Playwright e2e tests (viewport matrix + overflow check), automated contrast check, pytest 121/121 | ✅ Complete |
| 7 | Seed command (`scripts/seed.py`), MongoDB indexes for matches and gap_analyses, final README with Mermaid architecture + data flow, device support matrix, demo scenario, limitations | ✅ Complete |

---

## 15. Screenshots

> Screenshots will be taken after `docker compose up` and `python scripts/seed.py`
> have been run through the full demo scenario.

### Landing page (desktop)

![Landing page desktop](docs/screenshots/landing-desktop.png)

### Landing page (iPhone SE 375 px)

![Landing page mobile](docs/screenshots/landing-mobile.png)

### Dashboard (desktop — after matching)

![Dashboard desktop](docs/screenshots/dashboard-desktop.png)

### Gap Analysis (tablet — learning timeline)

![Gap Analysis tablet](docs/screenshots/gap-analysis-tablet.png)

### Camera capture (phone — document overlay)

![Camera capture mobile](docs/screenshots/camera-mobile.png)

> **Note:** The `docs/screenshots/` directory is a placeholder.
> Run the demo scenario and take screenshots at each viewport using the
> Playwright visual regression tests (`npm run test:e2e`) or manually.
