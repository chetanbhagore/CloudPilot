from datetime import datetime, timezone
from fastapi import APIRouter
from app.schemas import HealthResponse
from app.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="ok",
        version=settings.version,
        app_name=settings.app_name,
        mode="hybrid-aws",
        timestamp=datetime.now(timezone.utc).isoformat()
    )
