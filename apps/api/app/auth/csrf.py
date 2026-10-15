"""
CSRF protection — double-submit cookie pattern.
- On login success the server sets a csrf_token cookie (NOT httpOnly, so JS can read it).
- State-changing endpoints read X-CSRF-Token header and compare to the cookie.
- The verify_csrf dependency does the comparison.
"""

import secrets
from fastapi import Cookie, Header, HTTPException, status


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def verify_csrf(
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
    csrf_token: str | None = Cookie(default=None),
) -> None:
    """
    FastAPI dependency. Call as `Depends(verify_csrf)` on every
    state-changing route (POST, PUT, DELETE).
    """
    if not x_csrf_token or not csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )
    if not secrets.compare_digest(x_csrf_token, csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token invalid",
        )
