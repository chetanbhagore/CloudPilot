import logging
import secrets
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from app.schemas import (
    AccountConnectRequest,
    AccountConnectResponse,
    ConnectionStatus,
    ExecutionMode,
    AuthenticatedUser
)
from app.services.aws_sts import (
    assume_role,
    generate_demo_sts_session,
    validate_role_arn,
    STSConfigurationError,
    STSAssumeRoleError,
    STSAccountMismatchError,
    STSValidationError
)
from app.services.auth import get_current_user
from app.db.database import AccountRepository

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
            "connection_status": "connected",
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        _connected_accounts[f"demo:{sanitized_id}"] = account_info
        try:
            AccountRepository.save_account("org-acme-prod", account_info)
        except Exception as e:
            logger.warning(f"[DB] Non-fatal DB save error for demo account: {e}")

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
            "connection_status": "connected",
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        _connected_accounts[f"live:{sanitized_id}"] = account_info
        try:
            AccountRepository.save_account("org-acme-prod", account_info)
        except Exception as e:
            logger.warning(f"[DB] Non-fatal DB save error for live account: {e}")

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

@router.get("/external-id")
def generate_external_id(
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user)
):
    """
    Generates a cryptographically unpredictable tenant ExternalId for sts:AssumeRole.
    """
    user = current_user if isinstance(current_user, AuthenticatedUser) else None
    org_id = user.organization_id if user and not user.is_demo else "acme-tenant"
    rand_entropy = secrets.token_hex(16)
    return {
        "external_id": f"cp-{org_id}-{rand_entropy}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entropy_bits": 128
    }

@router.delete("/{account_id}")
def disconnect_account(account_id: str, mode: str = "live"):
    """
    Disconnects and removes an AWS account from the active registry.
    Returns complete AWS CLI and CloudFormation revocation procedure.
    """
    sanitized_id = account_id.replace("-", "").strip()
    key = f"{mode}:{sanitized_id}"
    deleted = False
    if key in _connected_accounts:
        del _connected_accounts[key]
        deleted = True
    
    try:
        db_deleted = AccountRepository.delete_account("org-acme-prod", sanitized_id, mode)
        deleted = deleted or db_deleted
    except Exception as e:
        logger.warning(f"[DB] Non-fatal DB delete error: {e}")

    if deleted:
        return {
            "success": True,
            "account_id": sanitized_id,
            "message": f"Account {sanitized_id} successfully disconnected from CloudPilot registry.",
            "revocation_procedure": {
                "step1": "Account connection removed and credentials evicted from memory.",
                "step2_aws_cli": "To revoke all trust on AWS, delete the CloudFormation stack:",
                "cli_command": "aws cloudformation delete-stack --stack-name CloudPilotAuditStack",
                "step3_manual": "Or delete IAM roles 'CloudPilotAuditRole' and 'CloudPilotRemediationRole' via AWS IAM Console."
            }
        }
    raise HTTPException(status_code=404, detail=f"Account {account_id} not found in {mode} mode.")
