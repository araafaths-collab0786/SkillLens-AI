"""
In-memory rate limiter for login attempts.
Limits: 5 attempts per minute per IP and per account.
Uses a sliding-window counter backed by a simple dict.
For production, replace with a Redis-backed implementation.
"""

import time
from collections import defaultdict
from threading import Lock


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            timestamps = self._buckets[key]
            # Remove expired entries
            self._buckets[key] = [t for t in timestamps if t > cutoff]
            if len(self._buckets[key]) >= self.max_requests:
                return False
            self._buckets[key].append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._buckets.pop(key, None)


# Shared instances — one per dimension
login_ip_limiter = RateLimiter(max_requests=5, window_seconds=60)
login_account_limiter = RateLimiter(max_requests=5, window_seconds=60)
upload_limiter = RateLimiter(max_requests=20, window_seconds=3600)
