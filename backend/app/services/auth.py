"""
Authentication and Role-Based Access Control (RBAC) Service
Phase 6: Server-Side Authentication, RBAC, and Tenant Isolation

Non-negotiable Rules:
- Server-side identity verification on every protected endpoint.
- Bind approvals to verified cryptographic identities, NOT caller-supplied email strings.
- Enforce strict organization tenant boundaries: cross-tenant access is rejected.
- Reject unauthenticated requests in live mode with 401 Unauthorized.
- Reject unauthorized roles with 403 Forbidden.
- Rate-limit login and sensitive authentication endpoints.
- Never use a hardcoded default user as an authenticated live actor.
"""

import os
import hmac
import json
import base64
import hashlib
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple, Callable
from fastapi import Header, HTTPException, Depends, Query, Request

from app.schemas import (
    UserProfileModel,
    AuthenticatedUser,
    UserRole,
    LoginRequest,
    LoginResponse
)

logger = logging.getLogger("cloudpilot.auth")

# HMAC Secret Key for Bearer Token Signing
# In production, this is sourced from AWS Secrets Manager / Environment variable
JWT_SECRET_KEY = os.getenv("CLOUDPILOT_AUTH_SECRET", "cp-sec-h7a8f9d0c1b2e3f4a5b6c7d8e9f0a1b2")
TOKEN_EXPIRY_HOURS = 24

ROLE_PERMISSIONS: Dict[UserRole, List[str]] = {
    "Viewer": [
        "view:findings",
        "view:accounts",
        "view:audit",
        "view:passport"
    ],
    "SecurityAnalyst": [
        "view:findings",
        "view:accounts",
        "view:audit",
        "view:passport",
        "scan:resources"
    ],
    "DevOpsLead": [
        "view:findings",
        "view:accounts",
        "view:audit",
        "view:passport",
        "scan:resources",
        "approve:remediation",
        "execute:remediation"
    ],
    "Admin": [
        "view:findings",
        "view:accounts",
        "view:audit",
        "view:passport",
        "scan:resources",
        "approve:remediation",
        "execute:remediation",
        "manage:accounts",
        "manage:users"
    ],
    "Owner": [
        "view:findings",
        "view:accounts",
        "view:audit",
        "view:passport",
        "scan:resources",
        "approve:remediation",
        "execute:remediation",
        "manage:accounts",
        "manage:users",
        "manage:organization"
    ]
}


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Hashes password using standard PBKDF2-HMAC-SHA256 with salt."""
    if not salt:
        salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return key.hex(), salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Constant-time verification of password against stored PBKDF2 hash."""
    calc_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(calc_hash, stored_hash)


# Pre-seeded Organizations and Users
ORGANIZATIONS: Dict[str, str] = {
    "org-acme-prod": "Acme Cloud Technologies",
    "org-evil-tenant": "Untrusted Third-Party Corp"
}

# Seed users: email -> user_record
USERS_DB: Dict[str, Dict[str, Any]] = {}

def _init_seed_users():
    seed_users = [
        {
            "id": "usr-owner-001",
            "email": "admin@acmecloud.io",
            "name": "Sarah Jenkins",
            "role": "Owner",
            "org_id": "org-acme-prod",
            "password": "CloudPilotAdmin2026!"
        },
        {
            "id": "usr-devops-002",
            "email": "devops@acmecloud.io",
            "name": "Marcus Vance",
            "role": "DevOpsLead",
            "org_id": "org-acme-prod",
            "password": "DevOpsLead2026!"
        },
        {
            "id": "usr-analyst-003",
            "email": "analyst@acmecloud.io",
            "name": "Elena Rostova",
            "role": "SecurityAnalyst",
            "org_id": "org-acme-prod",
            "password": "SecAnalyst2026!"
        },
        {
            "id": "usr-viewer-004",
            "email": "viewer@acmecloud.io",
            "name": "Tom Bradley",
            "role": "Viewer",
            "org_id": "org-acme-prod",
            "password": "ViewerOnly2026!"
        },
        {
            "id": "usr-attacker-999",
            "email": "attacker@evilcorp.io",
            "name": "Mallory Attacker",
            "role": "Admin",
            "org_id": "org-evil-tenant",
            "password": "EvilAttacker2026!"
        }
    ]
    for u in seed_users:
        h, salt = hash_password(u["password"])
        USERS_DB[u["email"].lower()] = {
            "id": u["id"],
            "email": u["email"].lower(),
            "name": u["name"],
            "role": u["role"],
            "org_id": u["org_id"],
            "password_hash": h,
            "salt": salt,
            "is_active": True
        }

_init_seed_users()

# ── Rate Limiting Store ────────────────────────────────────────────────────────
# key -> List[timestamps]
_RATE_LIMIT_STORE: Dict[str, List[float]] = {}

def check_rate_limit(key: str, max_attempts: int = 5, window_seconds: int = 60) -> bool:
    """
    Returns True if request is allowed, False if rate limited.
    """
    now = time.time()
    attempts = _RATE_LIMIT_STORE.get(key, [])
    # Prune old attempts
    attempts = [t for t in attempts if now - t < window_seconds]
    if len(attempts) >= max_attempts:
        _RATE_LIMIT_STORE[key] = attempts
        return False
    attempts.append(now)
    _RATE_LIMIT_STORE[key] = attempts
    return True


# ── Token Creation and Verification ────────────────────────────────────────────
def create_access_token(user: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> Tuple[str, int]:
    """Creates a tamper-evident HMAC-SHA256 bearer token."""
    now = datetime.now(timezone.utc)
    delta = expires_delta or timedelta(hours=TOKEN_EXPIRY_HOURS)
    exp = int((now + delta).timestamp())
    iat = int(now.timestamp())

    payload = {
        "sub": user["id"],
        "email": user["email"],
        "org_id": user["org_id"],
        "role": user["role"],
        "iat": iat,
        "exp": exp
    }

    payload_json = json.dumps(payload, separators=(",", ":"))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")
    
    signature = hmac.new(
        JWT_SECRET_KEY.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    token = f"{payload_b64}.{signature}"
    expires_in_seconds = int(delta.total_seconds())
    return token, expires_in_seconds


def verify_access_token(token: str) -> Dict[str, Any]:
    """
    Validates token signature and expiration.
    Returns payload dictionary on success, raises HTTPException on failure.
    """
    try:
        parts = token.strip().split(".")
        if len(parts) != 2:
            raise HTTPException(status_code=401, detail="Malformed authorization token.")
        
        payload_b64, signature = parts
        
        # Verify HMAC-SHA256 signature
        expected_sig = hmac.new(
            JWT_SECRET_KEY.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            logger.warning("[Auth] Invalid token signature detected.")
            raise HTTPException(status_code=401, detail="Invalid token signature.")

        # Decode payload
        # Pad base64 if needed
        padding = "=" * ((4 - len(payload_b64) % 4) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + padding)
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Verify expiration
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if payload.get("exp", 0) < now_ts:
            raise HTTPException(status_code=401, detail="Authorization token has expired.")

        return payload

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials.")


# ── FastAPI Authentication Dependencies ────────────────────────────────────────
def get_current_user(
    authorization: Optional[str] = Header(None),
    mode: str = Query("live")
) -> AuthenticatedUser:
    """
    FastAPI dependency that enforces server-side authentication on protected routes.
    FAILS CLOSED in live mode if token is missing, invalid, or expired.
    In explicit demo mode, returns demo simulated actor.
    """
    mode_str = mode if isinstance(mode, str) else "live"

    # If demo mode and no token provided, return explicitly simulated demo user
    if mode_str == "demo" and not authorization:
        return AuthenticatedUser(
            user_id="usr-demo-simulated",
            email="demo@cloudpilot.io",
            organization_id="org-demo-simulated",
            role="DevOpsLead",
            permissions=ROLE_PERMISSIONS["DevOpsLead"],
            is_demo=True
        )

    # In live mode (or whenever auth header provided), require valid Bearer token
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please provide 'Authorization: Bearer <token>' header.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization scheme. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = parts[1]
    payload = verify_access_token(token)

    role = payload.get("role", "Viewer")
    permissions = ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["Viewer"])

    return AuthenticatedUser(
        user_id=payload["sub"],
        email=payload["email"],
        organization_id=payload["org_id"],
        role=role,
        permissions=permissions,
        is_demo=False
    )


def require_permission(required_permission: str) -> Callable:
    """
    Dependency factory to enforce role-based permissions server-side.
    """
    def permission_checker(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if required_permission not in current_user.permissions:
            logger.warning(
                f"[Auth] Access denied for {current_user.email} (Role: {current_user.role}). "
                f"Requires permission '{required_permission}'."
            )
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Role '{current_user.role}' lacks required permission '{required_permission}'."
            )
        return current_user
    return permission_checker


def enforce_tenant_isolation(resource_org_id: str, current_user: AuthenticatedUser):
    """
    Verifies that the target resource belongs to the authenticated user's organization.
    Prevents cross-tenant IDOR attacks.
    """
    if current_user.is_demo:
        return
    if resource_org_id != current_user.organization_id:
        logger.error(
            f"[TenantIsolation] Cross-tenant access attempted by {current_user.email} "
            f"(Org: {current_user.organization_id}) against resource in Org: {resource_org_id}"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Forbidden: You do not have access to resources in tenant '{resource_org_id}'."
        )
