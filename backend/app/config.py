"""
Application Configuration and Environment Validation
Phase 14: Deployment and Operations
"""

import os
import logging
from typing import List, Literal
from pydantic import BaseModel, Field

logger = logging.getLogger("cloudpilot.config")

DEFAULT_DEV_SECRET = "cp-sec-h7a8f9d0c1b2e3f4a5b6c7d8e9f0a1b2"

class Settings(BaseModel):
    app_name: str = "CloudPilot Backend"
    version: str = "1.0.0"
    env: Literal["development", "staging", "production"] = Field(
        default=os.getenv("CLOUDPILOT_ENV", os.getenv("ENV", "development"))
    )
    port: int = int(os.getenv("PORT", "8000"))
    host: str = os.getenv("HOST", "0.0.0.0")
    
    # Security & Authentication Secrets
    auth_secret: str = os.getenv("CLOUDPILOT_AUTH_SECRET", DEFAULT_DEV_SECRET)
    token_expiry_hours: int = int(os.getenv("TOKEN_EXPIRY_HOURS", "24"))

    # AWS Operator Configuration
    default_region: str = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
    operator_account_id: str = os.getenv("OPERATOR_ACCOUNT_ID", "123456789012")
    operator_role_arn: str = os.getenv("OPERATOR_ROLE_ARN", "arn:aws:iam::123456789012:role/CloudPilotOperatorRole")
    
    # Database
    database_path: str = os.getenv("CLOUDPILOT_DB_PATH", "cloudpilot.db")

    # CORS Origins allowed
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            orig.strip()
            for orig in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
            ).split(",")
            if orig.strip()
        ]
    )

    def validate_production_readiness(self):
        """
        Validates production configuration invariants at startup.
        Fails fast if production environment uses insecure defaults.
        """
        if self.env == "production":
            if self.auth_secret == DEFAULT_DEV_SECRET:
                raise ValueError(
                    "[FATAL] In production mode, CLOUDPILOT_AUTH_SECRET must be set to a high-entropy secret. "
                    "Default developer secret is prohibited."
                )
            if len(self.auth_secret) < 32:
                raise ValueError(
                    f"[FATAL] CLOUDPILOT_AUTH_SECRET has insufficient length ({len(self.auth_secret)} chars). "
                    "Production requires at least 32 characters."
                )
            if "*" in self.cors_origins:
                raise ValueError(
                    "[FATAL] Blanket wildcard '*' is prohibited in CORS allow_origins in production."
                )
            logger.info("[Config] Production environment validation PASSED.")
        else:
            logger.info(f"[Config] Initialized in '{self.env}' mode.")

settings = Settings()
# If in non-production, allow wildcard for local development convenience
if settings.env != "production" and "*" not in settings.cors_origins:
    settings.cors_origins.append("*")
