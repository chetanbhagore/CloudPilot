"""
Health, Liveness, and Readiness Endpoints
Phase 14: Deployment and Operations
Non-negotiable Rules:
- Never disclose internal secrets, AWS keys, or file paths in health responses.
- Liveness verifies the HTTP server process is running and accepting requests.
- Readiness verifies underlying database connectivity and schema readiness.
- Return 503 Service Unavailable when dependencies are not ready.
"""

import time
from datetime import datetime, timezone
from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.db.database import get_db_connection

router = APIRouter(tags=["Health"])

STARTUP_TIME = time.time()


class LivenessResponse(BaseModel):
    status: str
    version: str
    app_name: str
    env: str
    uptime_seconds: float
    timestamp: str


class ReadinessResponse(BaseModel):
    status: str
    database: str
    version: str
    timestamp: str
    details: Optional[str] = None


@router.get("/health", response_model=LivenessResponse)
@router.get("/health/liveness", response_model=LivenessResponse)
def liveness_check():
    """
    K8s / ECS Liveness probe. Verifies the HTTP container is alive.
    Never exposes internal filesystem paths or database credentials.
    """
    now = datetime.now(timezone.utc)
    uptime = round(time.time() - STARTUP_TIME, 2)
    return LivenessResponse(
        status="ok",
        version=settings.version,
        app_name=settings.app_name,
        env=settings.env,
        uptime_seconds=uptime,
        timestamp=now.isoformat()
    )


@router.get("/health/readiness", response_model=ReadinessResponse)
def readiness_check(response: Response):
    """
    K8s / ECS Readiness probe. Verifies database connectivity and schema readiness.
    Fails closed with 503 if database connection fails.
    """
    now = datetime.now(timezone.utc).isoformat()
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1;")
            row = cursor.fetchone()
            if not row or row[0] != 1:
                raise RuntimeError("Database query failed to return expected result.")

            # Verify critical tables exist
            tables = [
                r[0] for r in cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            ]
            if "organizations" not in tables or "audit_events" not in tables:
                raise RuntimeError("Database schema incomplete.")

            return ReadinessResponse(
                status="ready",
                database="connected",
                version=settings.version,
                timestamp=now
            )
        finally:
            conn.close()

    except Exception as e:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(
            status="unhealthy",
            database="disconnected",
            version=settings.version,
            timestamp=now,
            details="Database health check failed."
        )
