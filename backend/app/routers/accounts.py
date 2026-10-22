import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from app.schemas import AccountConnectRequest, AccountConnectResponse, ConnectionStatus, ExecutionMode
from app.services.aws_sts import (
    assume_role,
    generate_demo_sts_session,
    validate_role_arn,
    STSConfigurationError,
    STSAssumeRoleError,
    STSAccountMismatchError,
    STSValidationError
)

logger = logging.getLogger("cloudpilot.accounts")
router = APIRouter(prefix="/accounts", tags=["Accounts"])

# In-memory account store partitioned by execution mode
_connected_accounts: Dict[str, Dict[str, Any]] = {}

@router.post("/connect", response_model=AccountConnectResponse)
def connect_account(request: AccountConnectRequest):
    """
    Connects an AWS account using STS AssumeRole with ExternalId confused-deputy defense.
    FAILS CLOSED in live mode: If AWS credentials or AssumeRole permissions are missing or invalid,
    reports real failure and refuses to register connection.
    Demo mode is isolated and clearly labeled.
    """
    sanitized_id = request.account_id.replace("-", "").strip()
    if len(sanitized_id) != 12 or not sanitized_id.isdigit():
        raise HTTPException(
            status_code=400,
            detail="AWS Account ID must be exactly 12 numeric digits (e.g. 123456789012)."
        )

    try:
        validate_role_arn(request.role_arn, expected_account_id=sanitized_id)
    except (STSValidationError, STSAccountMismatchError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ── Demo Mode Handling ──
    if request.mode == "demo":
        logger.info(f"[Accounts] Registering simulated demo account {sanitized_id}")
        demo_session = generate_demo_sts_session(
            account_id=sanitized_id,
            role_arn=request.role_arn,
            region=request.region
        )
        account_info = {
            "account_id": sanitized_id,
            "alias": f"Demo Account ({request.region})",
            "region": request.region,
            "role_arn": request.role_arn,
            "external_id": request.external_id,
            "assumed_role_user_arn": demo_session["assumed_role_user_arn"],
            "session_expiration": demo_session["expiration"],
            "is_live": False,
            "execution_mode": "demo",
            "connection_status": "connected"
        }
        _connected_accounts[f"demo:{sanitized_id}"] = account_info
        return AccountConnectResponse(
            success=True,
            account_id=sanitized_id,
            alias=account_info["alias"],
            region=request.region,
            role_arn=request.role_arn,
            assumed_role_user_arn=demo_session["assumed_role_user_arn"],
            session_expiration=demo_session["expiration"],
            is_live=False,
            execution_mode="demo",
            connection_status="connected",
            message="Demo simulation connection initialized (No real AWS credentials used)."
        )

    # ── Live AWS Mode Handling ──
    logger.info(f"[Accounts] Initiating live STS verification for {sanitized_id} with {request.role_arn}")
    try:
        sts_session = assume_role(
            role_arn=request.role_arn,
            external_id=request.external_id,
            session_name="CloudPilotLiveConnect",
            region=request.region,
            expected_account_id=sanitized_id
        )

        account_info = {
            "account_id": sanitized_id,
            "alias": f"AWS Live ({request.region})",
            "region": request.region,
            "role_arn": request.role_arn,
            "external_id": request.external_id,
            "assumed_role_user_arn": sts_session.get("assumed_role_user_arn"),
            "session_expiration": sts_session.get("expiration"),
            "is_live": True,
            "execution_mode": "live",
            "connection_status": "connected"
        }
        _connected_accounts[f"live:{sanitized_id}"] = account_info
        logger.info(f"[Accounts] Account {sanitized_id} verified and connected via live AWS STS")

        return AccountConnectResponse(
            success=True,
            account_id=sanitized_id,
            alias=account_info["alias"],
            region=request.region,
            role_arn=request.role_arn,
            assumed_role_user_arn=sts_session.get("assumed_role_user_arn"),
            session_expiration=sts_session.get("expiration"),
            is_live=True,
            execution_mode="live",
            connection_status="connected",
            message=f"Successfully established live STS AssumeRole session with ExternalId verification."
        )

    except STSConfigurationError as e:
        logger.error(f"[Accounts] Live connection configuration error: {e}")
        raise HTTPException(status_code=502, detail=f"AWS configuration error: {str(e)}")
    except STSAssumeRoleError as e:
        logger.error(f"[Accounts] Live AssumeRole rejected: {e}")
        raise HTTPException(status_code=403, detail=f"AWS AssumeRole failed: {str(e)}")
    except STSAccountMismatchError as e:
        logger.error(f"[Accounts] Account ID mismatch: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Accounts] Unexpected connection error: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error establishing AWS connection: {str(e)}")

@router.get("", response_model=List[Dict[str, Any]])
def list_accounts(mode: Optional[str] = Query(None, description="Filter accounts by execution mode ('live' or 'demo')")):
    """
    Lists connected AWS accounts filtered by mode.
    """
    accounts = list(_connected_accounts.values())
    mode_str = mode if isinstance(mode, str) else None
    if mode_str:
        accounts = [a for a in accounts if a.get("execution_mode") == mode_str]
    return accounts

@router.delete("/{account_id}")
def disconnect_account(account_id: str, mode: str = "live"):
    """
    Disconnects and removes an AWS account from the active registry.
    """
    sanitized_id = account_id.replace("-", "").strip()
    key = f"{mode}:{sanitized_id}"
    if key in _connected_accounts:
        del _connected_accounts[key]
        return {"success": True, "message": f"Account {sanitized_id} disconnected."}
    raise HTTPException(status_code=404, detail=f"Account {account_id} not found in {mode} mode.")
