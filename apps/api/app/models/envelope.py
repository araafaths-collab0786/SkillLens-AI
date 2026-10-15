"""
API envelope helper — wraps every response in { data, error, meta }.
"""
import uuid
from datetime import datetime, timezone
from typing import Any

API_VERSION = "1.0.0"


def ok(data: Any, *, uncalibrated: bool = False) -> dict:
    return {
        "data": data,
        "error": None,
        "meta": {
            "requestId": str(uuid.uuid4()),
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "version": API_VERSION,
            "uncalibrated": uncalibrated,
        },
    }


def err(code: str, message: str, *, status_code: int = 400, details: dict | None = None) -> dict:
    return {
        "data": None,
        "error": {"code": code, "message": message, "details": details or {}},
        "meta": {
            "requestId": str(uuid.uuid4()),
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "version": API_VERSION,
            "uncalibrated": False,
        },
    }
