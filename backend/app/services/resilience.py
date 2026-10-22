"""
Resilience & Standardized Failure Engine
Phase 8: Explicit, Reliable Failure Handling and Bounded Retries

Non-negotiable Rules:
- Structured error responses with consistent HTTP status codes.
- Distinguish validation, authentication, authorization, AWS permissions, throttling, timeouts, and internal errors.
- Bounded retries with backoff ONLY for safe, retryable operations.
- Never retry non-idempotent mutations without duplicate protection.
- Add timeouts to external calls.
- Never return a success result after an exception.
- Never leak raw stack traces, internal paths, or credentials to API consumers.
"""

import time
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Callable, List, TypeVar, Tuple
from fastapi.responses import JSONResponse
from fastapi import Request, HTTPException

from app.schemas import StandardErrorResponse

logger = logging.getLogger("cloudpilot.resilience")

RETRYABLE_AWS_CODES = {
    "Throttling",
    "ThrottlingException",
    "RequestLimitExceeded",
    "ProvisionedThroughputExceededException",
    "RequestTimeout",
    "RequestTimeoutException",
    "EndpointConnectionError",
    "ServiceUnavailable",
    "PriorRequestNotComplete"
}

NON_RETRYABLE_AWS_CODES = {
    "AccessDenied",
    "AccessDeniedException",
    "UnauthorizedOperation",
    "InvalidParameterValue",
    "ValidationError",
    "NoSuchEntity",
    "ResourceNotFoundException",
    "InvalidClientTokenId",
    "SignatureDoesNotMatch"
}

T = TypeVar("T")


def format_error_response(
    status_code: int,
    error_code: str,
    category: str,
    message: str,
    detail: Optional[str] = None,
    retryable: bool = False,
    correlation_id: Optional[str] = None
) -> JSONResponse:
    """
    Constructs a standardized JSON error response without exposing internal traces.
    """
    corr_id = correlation_id or f"corr-{uuid.uuid4().hex[:10]}"
    payload = {
        "error_code": error_code,
        "category": category,
        "message": message,
        "detail": detail,
        "retryable": retryable,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "correlation_id": corr_id
    }
    return JSONResponse(status_code=status_code, content=payload)


def classify_aws_exception(exception: Exception) -> Tuple[int, str, str, bool]:
    """
    Classifies AWS ClientError into (HTTP_status, error_code, category, is_retryable).
    """
    error_code = "AWS_ERROR"
    if hasattr(exception, "response") and isinstance(exception.response, dict):
        error_code = exception.response.get("Error", {}).get("Code", "AWS_ERROR")

    if error_code in RETRYABLE_AWS_CODES:
        return 429, error_code, "aws_throttling_error", True

    if error_code in ["AccessDenied", "UnauthorizedOperation", "AuthFailure"]:
        return 403, error_code, "aws_permission_error", False

    if error_code in ["ResourceNotFoundException", "InvalidGroup.NotFound", "InvalidVolume.NotFound"]:
        return 404, error_code, "resource_not_found", False

    if "timeout" in str(exception).lower():
        return 504, "AWS_TIMEOUT", "timeout_error", True

    return 500, error_code, "internal_error", False


def execute_bounded_retry(
    func: Callable[[], T],
    operation_name: str,
    max_retries: int = 3,
    backoff_base: float = 0.3,
    max_backoff: float = 3.0,
    is_mutation: bool = False,
    idempotency_key: Optional[str] = None
) -> T:
    """
    Executes a function with bounded exponential backoff.
    Guarantees:
      - Max retries strictly enforced.
      - Non-idempotent mutations without idempotency_key are NEVER retried.
      - Non-retryable permission errors fail immediately without backoff.
    """
    if is_mutation and not idempotency_key:
        # Non-idempotent mutation without duplicate protection: execute once, do not retry!
        return func()

    attempt = 0
    while True:
        try:
            return func()
        except Exception as e:
            attempt += 1
            status, code, category, retryable = classify_aws_exception(e)

            if not retryable or attempt > max_retries:
                logger.error(
                    f"[Resilience] {operation_name} failed (Attempt {attempt}/{max_retries + 1}). "
                    f"Code: {code}, Retryable: {retryable}. Error: {e}"
                )
                raise

            delay = min(backoff_base * (2 ** (attempt - 1)), max_backoff)
            logger.warning(
                f"[Resilience] {operation_name} received retryable error [{code}] on attempt {attempt}/{max_retries}. "
                f"Backing off {delay:.2f}s..."
            )
            time.sleep(delay)
