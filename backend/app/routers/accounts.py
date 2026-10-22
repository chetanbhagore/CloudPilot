import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.schemas import AccountConnectRequest, AccountConnectResponse
from app.services.aws_sts import assume_role

logger = logging.getLogger("cloudpilot.accounts")
router = APIRouter(prefix="/accounts", tags=["Accounts"])

# In-memory account store for fast, lightweight competition setup
_connected_accounts: Dict[str, Dict[str, Any]] = {}

@router.post("/connect", response_model=AccountConnectResponse)
def connect_account(request: AccountConnectRequest):
    """
    Validates AWS Account ID and performs STS AssumeRole handshake
    using unique ExternalId for confused-deputy defense.
    """
    sanitized_id = request.account_id.replace("-", "").strip()
    if len(sanitized_id) != 12 or not sanitized_id.isdigit():
        raise HTTPException(status_code=400, detail="AWS Account ID must be exactly 12 numeric digits.")

    if not request.role_arn.startswith("arn:aws:iam::"):
        raise HTTPException(status_code=400, detail="Invalid Role ARN format. Must begin with 'arn:aws:iam::'.")

    try:
        sts_session = assume_role(
            role_arn=request.role_arn,
            external_id=request.external_id,
            region=request.region
        )

        account_info = {
            "account_id": sanitized_id,
            "alias": f"AWS Live ({request.region})",
            "region": request.region,
            "role_arn": request.role_arn,
            "external_id": request.external_id,
            "assumed_role_user_arn": sts_session.get("assumed_role_user_arn"),
            "session_expiration": sts_session.get("expiration"),
            "is_live": not sts_session.get("is_simulated", False)
        }
        _connected_accounts[sanitized_id] = account_info

        logger.info(f"Account {sanitized_id} successfully registered via STS AssumeRole")

        return AccountConnectResponse(
            success=True,
            account_id=sanitized_id,
            alias=account_info["alias"],
            region=request.region,
            role_arn=request.role_arn,
            assumed_role_user_arn=sts_session.get("assumed_role_user_arn"),
            session_expiration=sts_session.get("expiration"),
            is_live=account_info["is_live"],
            message=f"Successfully established STS AssumeRole session with ExternalId verification."
        )

    except Exception as e:
        logger.error(f"STS connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to assume role: {str(e)}")

@router.get("", response_model=List[Dict[str, Any]])
def list_accounts():
    """
    Lists all connected AWS accounts.
    """
    return list(_connected_accounts.values())
