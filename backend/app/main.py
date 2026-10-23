import uuid
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import health, accounts, discovery, auth, audit, cost, ai_explain, deployments, contact
from app.services.resilience import format_error_response

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

# Configure CORS for React frontend (Vite & Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Correlation ID & Security Headers Middleware ──────────────────────────────
@app.middleware("http")
async def security_and_correlation_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID") or f"corr-{uuid.uuid4().hex[:12]}"
    request.state.correlation_id = correlation_id

    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.env == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ── Global Standardized Exception Handlers ─────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    category = "internal_error"
    if exc.status_code == 400:
        category = "validation_error"
    elif exc.status_code == 401:
        category = "authentication_error"
    elif exc.status_code == 403:
        category = "authorization_error"
    elif exc.status_code == 404:
        category = "resource_not_found"
    elif exc.status_code == 429:
        category = "rate_limit_error"

    return format_error_response(
        status_code=exc.status_code,
        error_code=f"HTTP_{exc.status_code}",
        category=category,
        message=str(exc.detail),
        retryable=(exc.status_code in [429, 503, 504])
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return format_error_response(
        status_code=400,
        error_code="VALIDATION_ERROR",
        category="validation_error",
        message="Request validation failed. Please check your payload schema.",
        detail=str(exc.errors())
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    correlation_id = f"err-{uuid.uuid4().hex[:10]}"
    logger.error(f"[ErrorHandler] Unhandled server error (Correlation ID: {correlation_id}): {exc}", exc_info=True)
    return format_error_response(
        status_code=500,
        error_code="INTERNAL_SERVER_ERROR",
        category="internal_error",
        message="An unexpected server error occurred. Please contact CloudPilot support with the correlation ID.",
        correlation_id=correlation_id,
        retryable=False
    )

# Register routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(discovery.router)
app.include_router(audit.router)
app.include_router(cost.router)
app.include_router(ai_explain.router)
app.include_router(deployments.router)
app.include_router(contact.router)

@app.on_event("startup")
def on_startup():
    settings.validate_production_readiness()
    from app.db.database import init_database_schema
    init_database_schema()
    logger.info("=" * 60)
    logger.info(f"🚀 {settings.app_name} v{settings.version} active on port {settings.port}")
    logger.info("🔒 Isolated Two-Role IAM Architecture Ready (Role 1: Audit, Role 2: Remediation)")
    logger.info("🛡️ Standardized Resilience & Failure Handlers Active")
    logger.info("💾 Relational Database Initialized & Tenant Isolation Ready")
    logger.info("=" * 60)
