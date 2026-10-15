"""
Database connection lifecycle.

Uses PyMongo Async (pymongo.AsyncMongoClient ≥ 4.7).
Gate 1 approved 2025-07-11.

Connection is opened once at startup via FastAPI lifespan and stored on
app.state so all routers share one client. This follows PyMongo's
recommended pattern: create one AsyncMongoClient per process.
"""

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.config import settings

# Module-level holder — populated by lifespan, never used directly by routers
_client: AsyncMongoClient | None = None
_db: AsyncDatabase | None = None


async def connect() -> None:
    """Open the MongoDB connection. Called from FastAPI lifespan startup."""
    global _client, _db
    _client = AsyncMongoClient(
        settings.mongo_uri,
        # Use server-side sessions for transactions if needed
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=10000,
        maxPoolSize=10,
        retryWrites=True,
        retryReads=True,
    )
    _db = _client["skilllens"]
    # Ping to surface misconfiguration at startup, not at first request
    await _client.admin.command("ping")


async def disconnect() -> None:
    """Close the MongoDB connection. Called from FastAPI lifespan shutdown."""
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None


def get_db() -> AsyncDatabase:
    """
    Return the shared AsyncDatabase instance.
    FastAPI dependency: `db: AsyncDatabase = Depends(get_db)`.
    Raises RuntimeError if called before lifespan startup.
    """
    if _db is None:
        raise RuntimeError(
            "Database not connected. Ensure lifespan startup completed successfully."
        )
    return _db
