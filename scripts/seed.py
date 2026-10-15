#!/usr/bin/env python3
"""
SkillLens AI — Seed Script (Phase 7)

Seeds the MongoDB database with:
  1. 20 job roles across IT, data, healthcare, logistics, and skilled trades
     (from apps/api/app/data/jobs_seed.py)
  2. One demo user for the end-to-end demo scenario

Usage (inside the apps/api directory with .venv active):
    python scripts/seed.py

Or from the repo root:
    python SkillLens-AI/scripts/seed.py

Options:
    --reset     Drop and re-seed all jobs and the demo user (idempotent).
    --jobs-only Seed only jobs (no demo user).
    --user-only Seed only the demo user (no jobs).

Environment:
    Reads MONGO_URI from .env or the environment.
    Requires: pymongo, python-dotenv, bcrypt.

Exit codes:
    0 — success
    1 — error (missing config, connection failure, etc.)
"""

import argparse
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[1]   # SkillLens-AI/
API_DIR   = REPO_ROOT / "apps" / "api"
sys.path.insert(0, str(API_DIR))

# Load .env from the repo root
try:
    from dotenv import load_dotenv
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / ".env.example")
except ImportError:
    pass  # dotenv not installed; rely on environment variables

# ── Imports ───────────────────────────────────────────────────────────────────
try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, OperationFailure
except ImportError:
    print("ERROR: pymongo is not installed. Run: pip install pymongo", file=sys.stderr)
    sys.exit(1)

try:
    import bcrypt as bcrypt_lib
except ImportError:
    print("ERROR: bcrypt is not installed. Run: pip install bcrypt", file=sys.stderr)
    sys.exit(1)

try:
    from app.data.jobs_seed import JOBS_SEED
except ImportError as e:
    print(f"ERROR: Could not import JOBS_SEED: {e}", file=sys.stderr)
    sys.exit(1)

# ── Demo user config ──────────────────────────────────────────────────────────

DEMO_USER = {
    "full_name":  "Demo Candidate",
    "email":      "demo@skilllens.ai",
    "password":   "DemoPassword2026!",  # meets 12-char minimum
    "role":       "job_seeker",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    salt = bcrypt_lib.gensalt(rounds=12)
    return bcrypt_lib.hashpw(plain.encode(), salt).decode()


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _format_job_for_mongo(seed: dict) -> dict:
    """Convert JOBS_SEED dict format to MongoDB document format."""
    return {
        "_id":    str(uuid.uuid4()),
        "title":  seed["title"],
        "category": seed["category"],
        "sdgAligned": seed.get("sdg_aligned", True),
        "requiredSkills": [
            {
                "esco_uri":   s["esco_uri"],
                "esco_label": s["esco_label"],
                "weight":     s["weight"],
            }
            for s in seed.get("required_skills", [])
        ],
        "niceToHaveSkills": [
            {
                "escoId": s["esco_uri"],
                "label":  s["esco_label"],
            }
            for s in seed.get("nice_to_have_skills", [])
        ],
        "learningSteps": [
            {
                "esco_uri":    s["esco_uri"],
                "step_type":   s["step_type"],
                "title":       s["title"],
                "effort_weeks": s["effort_weeks"],
                "step_order":  s["step_order"],
            }
            for s in seed.get("learning_steps", [])
        ],
        "createdAt": _now(),
    }


# ── Seed jobs ─────────────────────────────────────────────────────────────────

def seed_jobs(db, reset: bool = False) -> int:
    """Upsert all 20 jobs. Returns count of upserted documents."""
    if reset:
        result = db["jobs"].delete_many({})
        print(f"  ↳ Deleted {result.deleted_count} existing job(s).")

    upserted = 0
    for seed in JOBS_SEED:
        doc = _format_job_for_mongo(seed)
        result = db["jobs"].update_one(
            {"title": doc["title"]},  # idempotent on title
            {"$setOnInsert": doc},
            upsert=True,
        )
        if result.upserted_id:
            upserted += 1

    existing = db["jobs"].count_documents({})
    print(f"  ✓ Jobs: {upserted} inserted, {existing} total in collection.")
    return upserted


# ── Seed demo user ────────────────────────────────────────────────────────────

def seed_demo_user(db, reset: bool = False) -> bool:
    """Create the demo user if not present. Returns True if created."""
    if reset:
        result = db["users"].delete_one({"email": DEMO_USER["email"]})
        if result.deleted_count:
            print(f"  ↳ Deleted existing demo user ({DEMO_USER['email']}).")

    existing = db["users"].find_one({"email": DEMO_USER["email"]})
    if existing:
        print(f"  ✓ Demo user already exists: {DEMO_USER['email']} (skipped).")
        return False

    doc = {
        "_id":        str(uuid.uuid4()),
        "fullName":   DEMO_USER["full_name"],
        "email":      DEMO_USER["email"],
        "passwordHash": _hash_password(DEMO_USER["password"]),
        "role":       DEMO_USER["role"],
        "createdAt":  _now(),
    }
    db["users"].insert_one(doc)
    print(f"  ✓ Demo user created: {DEMO_USER['email']}")
    print(f"    Password:  {DEMO_USER['password']}")
    print(f"    Role:      {DEMO_USER['role']}")
    print(f"    ID:        {doc['_id']}")
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Seed SkillLens AI MongoDB with jobs and a demo user."
    )
    parser.add_argument("--reset",      action="store_true", help="Drop and re-seed (idempotent).")
    parser.add_argument("--jobs-only",  action="store_true", help="Seed jobs only.")
    parser.add_argument("--user-only",  action="store_true", help="Seed demo user only.")
    args = parser.parse_args()

    mongo_uri = os.environ.get("MONGO_URI", "")
    if not mongo_uri:
        print(
            "ERROR: MONGO_URI environment variable is not set.\n"
            "  Set it in your .env file or export it before running this script.",
            file=sys.stderr,
        )
        return 1

    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║             SkillLens AI — Database Seed (Phase 7)           ║")
    print("╚══════════════════════════════════════════════════════════════╝\n")
    print(f"Connecting to MongoDB…")

    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        # Trigger connection
        client.admin.command("ping")
        db = client["skilllens"]
        print("  ✓ Connected.\n")
    except ConnectionFailure as e:
        print(f"ERROR: Could not connect to MongoDB: {e}", file=sys.stderr)
        return 1
    except OperationFailure as e:
        print(f"ERROR: MongoDB authentication failed: {e}", file=sys.stderr)
        return 1

    try:
        if not args.user_only:
            print("Seeding jobs…")
            seed_jobs(db, reset=args.reset)
            print()

        if not args.jobs_only:
            print("Seeding demo user…")
            seed_demo_user(db, reset=args.reset)
            print()

    except Exception as e:
        print(f"ERROR during seeding: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1
    finally:
        client.close()

    print("✅ Seed complete.")
    print()
    print("Demo scenario:")
    print(f"  1. Open http://localhost:3000/login")
    print(f"  2. Sign in with email={DEMO_USER['email']}, password={DEMO_USER['password']}")
    print(f"  3. Upload a resume (or use the camera capture method).")
    print(f"  4. Select a target job on /match.")
    print(f"  5. View your Readiness Index and click 'Analyze skill gaps'.")
    print(f"  6. Follow the learning path on /gap-analysis.")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
