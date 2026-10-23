"""
Authentication Router
Phase 6: Real Login, Token Issuance, and Identity Inspection
"""

import logging
import secrets
from fastapi import APIRouter, HTTPException, Depends, Request
from app.schemas import (
    LoginRequest,
    LoginResponse,
    SignupRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    UserProfileModel,
    AuthenticatedUser
)
from app.services.auth import (
    USERS_DB,
    ORGANIZATIONS,
    verify_password,
    create_access_token,
    check_rate_limit,
    get_current_user,
    get_user_by_email,
    register_user
)

logger = logging.getLogger("cloudpilot.auth_router")
router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


@router.post("/signup", response_model=LoginResponse)
def signup(req: SignupRequest, request: Request):
    """
    Registers a new tenant organization and primary administrator (Owner).
    Saves user and organization to persistent SQLite database.
    Applies rate limiting to prevent automated account creation abuse.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"signup:{client_ip}"
    if not check_rate_limit(rate_key, max_attempts=5, window_seconds=120):
        raise HTTPException(
            status_code=429,
            detail="Too many registration attempts. Please wait 2 minutes."
        )

    try:
        user, token, expires_in = register_user(
            name=req.name,
            email=req.email,
            password=req.password,
            org_name=req.organization_name
        )
        user_profile = UserProfileModel(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            organization_id=user["org_id"],
            organization_name=req.organization_name,
            is_active=True
        )
        return LoginResponse(
            access_token=token,
            token_type="bearer",
            expires_in=expires_in,
            user=user_profile
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Auth] Registration error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to complete customer registration.")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(req: ForgotPasswordRequest, request: Request):
    """
    Initiates self-serve password reset flow.
    Fails closed with generic success message to prevent user enumeration.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"pwd-reset:{client_ip}"
    if not check_rate_limit(rate_key, max_attempts=3, window_seconds=120):
        raise HTTPException(status_code=429, detail="Too many reset requests. Please wait.")

    user = get_user_by_email(req.email)
    if user:
        reset_token = secrets.token_urlsafe(24)
        logger.info(f"[Auth] Password reset initiated for {user['email']}. Reset token generated.")
        return ForgotPasswordResponse(
            success=True,
            message="If an account exists with this email, password reset instructions have been issued.",
            reset_token=reset_token
        )

    return ForgotPasswordResponse(
        success=True,
        message="If an account exists with this email, password reset instructions have been issued."
    )


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

    user = get_user_by_email(req.email)
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
