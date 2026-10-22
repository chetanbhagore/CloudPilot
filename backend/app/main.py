import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import health, accounts, discovery, auth

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cloudpilot")

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="CloudPilot Human-in-the-Loop Cloud Operations Platform — Hybrid Competition API"
)

# Configure CORS for React frontend (Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(discovery.router)

@app.on_event("startup")
def on_startup():
    logger.info("=" * 60)
    logger.info(f"🚀 {settings.app_name} v{settings.version} active on port {settings.port}")
    logger.info("🔒 Isolated Two-Role IAM Architecture Ready (Role 1: Audit, Role 2: Remediation)")
    logger.info("=" * 60)
