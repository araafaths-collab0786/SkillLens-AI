"""
JWT token creation and validation.
Access tokens: 15 min, stored in httpOnly cookie.
Refresh tokens: 7 days, stored in httpOnly SameSite=Strict cookie.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings

ALGORITHM = "HS256"


class TokenPayload(BaseModel):
    sub: str          # user ID
    type: str         # "access" | "refresh"
    family: str       # token family ID (for rotation / reuse detection)
    exp: datetime
    iat: datetime


def create_access_token(user_id: str, family_id: str) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": user_id,
        "type": "access",
        "family": family_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, family_id: str) -> tuple[str, str]:
    """
    Returns (token_string, token_hash).
    Store only the hash in the database.
    """
    now = datetime.now(tz=timezone.utc)
    token_id = secrets.token_urlsafe(32)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "family": family_id,
        "jti": token_id,
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_refresh_expires_days),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


def decode_token(token: str) -> Optional[TokenPayload]:
    """Returns TokenPayload or None if invalid/expired."""
    try:
        raw = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return TokenPayload(**raw)
    except (JWTError, Exception):
        return None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
