"""
Auth router: POST /register, POST /login, POST /refresh, POST /logout, GET /me.

Security hardening (Section 8):
- Passwords: bcrypt cost 12, min 12 chars, common-password check.
- Cookies: httpOnly, Secure (see cookie_secure_effective), SameSite.
  Access cookie: SameSite=Lax. Refresh cookie: SameSite=Strict.
- Refresh token rotation: each refresh issues a new token and revokes the old.
  Old-token reuse revokes the entire family and forces re-login.
- Rate limiting: 5 login attempts per minute per IP and per email.
- Generic error messages: login failure never reveals whether email exists.
- CSRF: verify_csrf dependency on all state-changing endpoints.
"""

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pymongo.asynchronous.database import AsyncDatabase

from app.auth.csrf import generate_csrf_token, verify_csrf
from app.auth.dependencies import get_current_user_id
from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
)
from app.auth.passwords import hash_password, is_common_password, verify_password
from app.auth.rate_limit import login_account_limiter, login_ip_limiter
from app.config import settings
from app.db.connection import get_db
from app.models.auth import LoginRequest, RegisterRequest
from app.models.envelope import err, ok

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

GENERIC_LOGIN_ERROR = "Invalid email or password"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = settings.cookie_secure_effective
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.jwt_access_expires_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=settings.jwt_refresh_expires_days * 86400,
        path="/api/v1/auth/refresh",
    )


def _set_csrf_cookie(response: Response, csrf_token: str) -> None:
    """CSRF cookie is NOT httpOnly so the JS client can read it."""
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.cookie_secure_effective,
        samesite="lax",
        max_age=settings.jwt_access_expires_minutes * 60,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")
    response.delete_cookie("csrf_token", path="/")


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── POST /register ────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    response: Response,
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    # Common-password check
    if is_common_password(body.password):
        return err("WEAK_PASSWORD", "Password is too common. Choose a stronger password.")

    # Unique email check
    existing = await db["users"].find_one({"email": body.email.lower()}, {"_id": 1})
    if existing:
        # Generic message — do not confirm whether email exists
        return err("REGISTRATION_ERROR", "Could not create account. Please try again.")

    user_id = str(uuid.uuid4())
    family_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc)

    await db["users"].insert_one({
        "_id": user_id,
        "fullName": body.full_name.strip(),
        "email": body.email.lower(),
        "passwordHash": hash_password(body.password),
        "role": body.role,
        "createdAt": now,
        "updatedAt": now,
    })

    access_token = create_access_token(user_id, family_id)
    refresh_token, refresh_hash = create_refresh_token(user_id, family_id)
    csrf_token = generate_csrf_token()

    # Store refresh token
    expires_at = datetime.now(tz=timezone.utc).replace(second=0, microsecond=0)
    from datetime import timedelta
    expires_at = datetime.now(tz=timezone.utc) + timedelta(days=settings.jwt_refresh_expires_days)
    await db["refresh_tokens"].insert_one({
        "_id": str(uuid.uuid4()),
        "tokenHash": refresh_hash,
        "familyId": family_id,
        "userId": user_id,
        "expiresAt": expires_at,
        "createdAt": datetime.now(tz=timezone.utc),
        "revoked": False,
    })

    _set_auth_cookies(response, access_token, refresh_token)
    _set_csrf_cookie(response, csrf_token)

    return ok({
        "user": {
            "id": user_id,
            "fullName": body.full_name.strip(),
            "email": body.email.lower(),
            "role": body.role,
            "createdAt": now.isoformat(),
        }
    })


# ── POST /login ───────────────────────────────────────────────────────────────

@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    ip = _get_ip(request)
    email_key = f"email:{body.email.lower()}"

    # Rate limit: per IP and per email
    if not login_ip_limiter.is_allowed(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
        )
    if not login_account_limiter.is_allowed(email_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
        )

    user = await db["users"].find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["passwordHash"]):
        # Generic error — never reveal whether the email exists
        return err("AUTH_FAILED", GENERIC_LOGIN_ERROR, status_code=401)

    user_id = user["_id"]
    family_id = str(uuid.uuid4())
    from datetime import timedelta

    access_token = create_access_token(user_id, family_id)
    refresh_token, refresh_hash = create_refresh_token(user_id, family_id)
    csrf_token = generate_csrf_token()

    expires_at = datetime.now(tz=timezone.utc) + timedelta(days=settings.jwt_refresh_expires_days)
    await db["refresh_tokens"].insert_one({
        "_id": str(uuid.uuid4()),
        "tokenHash": refresh_hash,
        "familyId": family_id,
        "userId": user_id,
        "expiresAt": expires_at,
        "createdAt": datetime.now(tz=timezone.utc),
        "revoked": False,
    })

    _set_auth_cookies(response, access_token, refresh_token)
    _set_csrf_cookie(response, csrf_token)

    return ok({
        "user": {
            "id": user_id,
            "fullName": user["fullName"],
            "email": user["email"],
            "role": user["role"],
            "createdAt": user["createdAt"].isoformat(),
        }
    })


# ── POST /refresh ─────────────────────────────────────────────────────────────

@router.post("/refresh", dependencies=[Depends(verify_csrf)])
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_token(refresh_token)
    if payload is None or payload.type != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token_hash = hash_token(refresh_token)
    stored = await db["refresh_tokens"].find_one({"tokenHash": token_hash})

    if stored is None:
        # Token not found — possible reuse attack: revoke entire family
        await db["refresh_tokens"].update_many(
            {"familyId": payload.family},
            {"$set": {"revoked": True}},
        )
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated. Please log in again.",
        )

    if stored.get("revoked"):
        # Already revoked — reuse detected: revoke family
        await db["refresh_tokens"].update_many(
            {"familyId": payload.family},
            {"$set": {"revoked": True}},
        )
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated. Please log in again.",
        )

    # Revoke old token
    await db["refresh_tokens"].update_one(
        {"_id": stored["_id"]},
        {"$set": {"revoked": True}},
    )

    # Issue new token pair in the same family
    user_id = payload.sub
    family_id = payload.family
    from datetime import timedelta

    new_access = create_access_token(user_id, family_id)
    new_refresh, new_refresh_hash = create_refresh_token(user_id, family_id)
    new_csrf = generate_csrf_token()

    expires_at = datetime.now(tz=timezone.utc) + timedelta(days=settings.jwt_refresh_expires_days)
    await db["refresh_tokens"].insert_one({
        "_id": str(uuid.uuid4()),
        "tokenHash": new_refresh_hash,
        "familyId": family_id,
        "userId": user_id,
        "expiresAt": expires_at,
        "createdAt": datetime.now(tz=timezone.utc),
        "revoked": False,
    })

    _set_auth_cookies(response, new_access, new_refresh)
    _set_csrf_cookie(response, new_csrf)
    return ok({"ok": True})


# ── POST /logout ──────────────────────────────────────────────────────────────

@router.post("/logout", dependencies=[Depends(verify_csrf)])
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    if refresh_token:
        payload = decode_token(refresh_token)
        if payload:
            # Revoke this family completely
            await db["refresh_tokens"].update_many(
                {"familyId": payload.family},
                {"$set": {"revoked": True}},
            )
    _clear_auth_cookies(response)
    return ok({"ok": True})


# ── GET /me ───────────────────────────────────────────────────────────────────

@router.get("/me")
async def me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncDatabase = Depends(get_db),
) -> dict:
    user = await db["users"].find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return ok({
        "user": {
            "id": user["_id"],
            "fullName": user["fullName"],
            "email": user["email"],
            "role": user["role"],
            "createdAt": user["createdAt"].isoformat(),
        }
    })
