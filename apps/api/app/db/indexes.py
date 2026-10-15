"""
MongoDB index definitions. Called once at startup.
"""
from pymongo import ASCENDING, DESCENDING
from pymongo.asynchronous.database import AsyncDatabase


async def create_indexes(db: AsyncDatabase) -> None:
    # users
    await db["users"].create_index([("email", ASCENDING)], unique=True)
    # resumes
    await db["resumes"].create_index([("userId", ASCENDING)])
    await db["resumes"].create_index([("submissionId", ASCENDING)], unique=True)
    await db["resumes"].create_index([("createdAt", DESCENDING)])
    # jobs
    await db["jobs"].create_index([("category", ASCENDING)])
    # refresh_tokens
    await db["refresh_tokens"].create_index([("tokenHash", ASCENDING)], unique=True)
    await db["refresh_tokens"].create_index([("familyId", ASCENDING)])
    await db["refresh_tokens"].create_index([("expiresAt", ASCENDING)], expireAfterSeconds=0)
    # matches — one match record per user+resume+job triple
    await db["matches"].create_index(
        [("userId", ASCENDING), ("resumeId", ASCENDING), ("jobId", ASCENDING)],
        unique=True,
    )
    await db["matches"].create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])
    # gap_analyses
    await db["gap_analyses"].create_index(
        [("userId", ASCENDING), ("resumeId", ASCENDING), ("jobId", ASCENDING)],
        unique=True,
    )
    await db["gap_analyses"].create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])
