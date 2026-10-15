"""
Application configuration via Pydantic Settings.
Values are read from environment variables and .env files.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_env: str = "development"

    # MongoDB — URI only; no driver imported until Gate 1 approved.
    # The driver module will be conditionally imported at runtime once approved.
    mongo_uri: str = ""  # PENDING Gate 1 approval

    # Auth
    jwt_secret: str = ""
    jwt_access_expires_minutes: int = 15
    jwt_refresh_expires_days: int = 7

    # Cookie security
    # NEVER set False in production. Loaded only when app_env = development.
    cookie_secure: bool = True

    @property
    def cookie_secure_effective(self) -> bool:
        """
        Returns True unless APP_ENV=development AND cookie_secure=False.
        This prevents dev-only settings leaking into production.
        """
        if self.app_env == "development" and not self.cookie_secure:
            return False
        return True

    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]

    # Upload limits
    upload_max_size_mb: int = 10
    upload_max_dimension_px: int = 4000
    upload_max_megapixels: int = 16
    upload_max_pdf_pages: int = 5
    upload_rate_limit_per_hour: int = 20
    upload_processing_timeout_seconds: int = 20

    # Retention
    resume_retention_days: int = 30
    temp_file_dir: str = "/tmp/skilllens_uploads"


settings = Settings()
