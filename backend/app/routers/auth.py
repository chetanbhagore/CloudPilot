"""
Authentication Router
Phase 6: Real Login, Token Issuance, and Identity Inspection
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from app.schemas import (
    LoginRequest,
    LoginResponse,
    UserProfileModel,
    AuthenticatedUser
)
from app.services.auth import (
    USERS_DB,
    ORGANIZATIONS,
    verify_password,
    create_access_token,
    check_rate_limit,
    get_current_user
)

logger = logging.getLogger("cloudpilot.auth_router")
router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request):
    """
    Authenticates user credentials and issues a signed bearer token.
    Applies IP and email-based rate limiting to protect against brute-force attacks.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{req.email.lower()}"

    if not check_rate_limit(rate_key, max_attempts=5, window_seconds=60):
        logger.warning(f"[Auth] Rate limit exceeded for login attempts: {rate_key}")
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please wait 60 seconds before trying again."
        )

    user = USERS_DB.get(req.email.lower())
    if not user or not verify_password(req.password, user["password_hash"], user["salt"]):
        logger.warning(f"[Auth] Invalid login attempt for email: {req.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account has been deactivated.")

    token, expires_in = create_access_token(user)

    user_profile = UserProfileModel(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        organization_id=user["org_id"],
        organization_name=ORGANIZATIONS.get(user["org_id"], "Acme Cloud Technologies"),
        is_active=user["is_active"]
    )

    logger.info(f"[Auth] User {user['email']} successfully authenticated (Org: {user['org_id']}, Role: {user['role']}).")

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=user_profile
    )


@router.get("/me", response_model=UserProfileModel)
def get_current_user_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns server-verified identity, role, and organization for the current caller.
    Never relies on client-supplied impersonation headers or personas.
    """
    user = USERS_DB.get(current_user.email.lower())
    user_name = user["name"] if user else current_user.email.split("@")[0].title()

    return UserProfileModel(
        id=current_user.user_id,
        email=current_user.email,
        name=user_name,
        role=current_user.role,
        organization_id=current_user.organization_id,
        organization_name=ORGANIZATIONS.get(current_user.organization_id, "Cloud Operations Org"),
        is_active=True
    )


@router.post("/logout")
def logout(current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Terminates current user session.
    """
    logger.info(f"[Auth] User {current_user.email} logged out.")
    return {"success": True, "message": "Successfully logged out."}
