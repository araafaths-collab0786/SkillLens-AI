"""
Password hashing and validation.
- bcrypt via the bcrypt library (not passlib).
- Minimum 12 characters enforced at Pydantic schema level.
- Common-password check against a bundled top-10k list.
"""

import bcrypt

from app.auth.common_passwords import COMMON_PASSWORDS


def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt (cost factor 12)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode(), salt).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time comparison via bcrypt."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def is_common_password(plain: str) -> bool:
    """Return True if the password is on the common-password list."""
    return plain.lower() in COMMON_PASSWORDS
