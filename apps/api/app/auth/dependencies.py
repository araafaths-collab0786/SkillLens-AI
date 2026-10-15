"""
FastAPI dependency that validates the access-token cookie and returns the
current authenticated user ID.
"""

from fastapi import Cookie, Depends, HTTPException, status
from pymongo.asynchronous.database import AsyncDatabase

from app.auth.jwt import decode_token
from app.db.connection import get_db


async def get_current_user_id(
    access_token: str | None = Cookie(default=None),
    db: AsyncDatabase = Depends(get_db),
) -> str:
    """
    Reads the access_token httpOnly cookie, decodes it, and returns the user ID.
    Raises HTTP 401 if missing, expired, or revoked.
    """
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_token(access_token)
    if payload is None or payload.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    # Verify user still exists (not deleted)
    user = await db["users"].find_one({"_id": payload.sub}, {"_id": 1})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return payload.sub
