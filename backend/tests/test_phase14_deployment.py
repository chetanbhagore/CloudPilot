"""
Phase 14: Deployment, Environment Validation, and Operations Tests
Non-negotiable Rules:
- Liveness check returns 200 OK without exposing secrets or paths.
- Readiness check verifies database health and returns 503 on database failure.
- Production environment validation fails fast on default or weak secrets.
- Security headers and correlation IDs are attached to every response.
"""

import unittest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import Settings, DEFAULT_DEV_SECRET
from app.routers.health import liveness_check, readiness_check
from app.db.database import init_database_schema
from fastapi import Response


class TestPhase14DeploymentAndOperations(unittest.TestCase):
    def setUp(self):
        init_database_schema()

    def test_liveness_check_does_not_disclose_secrets(self):
        """Liveness probe returns 200 OK and never leaks secret keys or connection strings."""
        resp = liveness_check()
        self.assertEqual(resp.status, "ok")
        self.assertGreaterEqual(resp.uptime_seconds, 0)
        self.assertIsNotNone(resp.version)

        # Confirm no sensitive fields in response
        dumped = resp.model_dump()
        for sensitive_key in ["secret", "password", "key", "token", "db_path"]:
            self.assertNotIn(sensitive_key, dumped)

    def test_readiness_check_healthy_database(self):
        """Readiness probe verifies database connectivity and returns ready status."""
        mock_response = Response()
        resp = readiness_check(response=mock_response)
        self.assertEqual(mock_response.status_code, 200)
        self.assertEqual(resp.status, "ready")
        self.assertEqual(resp.database, "connected")

    @patch("app.routers.health.get_db_connection")
    def test_readiness_check_fails_closed_on_db_outage(self, mock_get_conn):
        """Readiness probe returns 503 Service Unavailable when database is unreachable."""
        mock_get_conn.side_effect = RuntimeError("Disk I/O error or SQLite database locked")
        mock_response = Response()
        resp = readiness_check(response=mock_response)

        self.assertEqual(mock_response.status_code, 503)
        self.assertEqual(resp.status, "unhealthy")
        self.assertEqual(resp.database, "disconnected")

    def test_production_environment_validation_rejects_default_secret(self):
        """Settings.validate_production_readiness() fails fast if default dev secret is used in prod."""
        prod_settings = Settings(
            env="production",
            auth_secret=DEFAULT_DEV_SECRET,
            cors_origins=["https://app.cloudpilot.io"]
        )
        with self.assertRaises(ValueError) as ctx:
            prod_settings.validate_production_readiness()
        self.assertIn("Default developer secret is prohibited", str(ctx.exception))

    def test_production_environment_validation_rejects_short_secret(self):
        """Settings.validate_production_readiness() fails fast if secret length is < 32 characters."""
        prod_settings = Settings(
            env="production",
            auth_secret="too-short-secret-key-12345",  # 27 chars < 32
            cors_origins=["https://app.cloudpilot.io"]
        )
        with self.assertRaises(ValueError) as ctx:
            prod_settings.validate_production_readiness()
        self.assertIn("insufficient length", str(ctx.exception))

    def test_production_environment_validation_rejects_cors_wildcard(self):
        """Settings.validate_production_readiness() fails fast if CORS contains wildcard in prod."""
        prod_settings = Settings(
            env="production",
            auth_secret="a_valid_high_entropy_secret_for_production_testing_1234567890",
            cors_origins=["https://app.cloudpilot.io", "*"]
        )
        with self.assertRaises(ValueError) as ctx:
            prod_settings.validate_production_readiness()
        self.assertIn("Blanket wildcard '*' is prohibited in CORS", str(ctx.exception))

    def test_production_environment_validation_passes_valid_config(self):
        """Settings.validate_production_readiness() succeeds when all production criteria are met."""
        valid_prod_settings = Settings(
            env="production",
            auth_secret="super_secure_production_secret_key_32_characters_minimum_entropy!",
            cors_origins=["https://app.cloudpilot.io"]
        )
        # Must not raise an exception
        valid_prod_settings.validate_production_readiness()


if __name__ == "__main__":
    unittest.main()
