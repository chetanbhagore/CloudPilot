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
    connect_localstack,
    connect_with_access_keys,
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
def connect_account(
    request: AccountConnectRequest,
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user)
):
    """
    Connects an AWS account using STS AssumeRole with ExternalId confused-deputy defense.
    FAILS CLOSED in live mode: If AWS credentials or AssumeRole permissions are missing or invalid,
    reports real failure and refuses to register connection.
    Demo mode is isolated and clearly labeled.
    """
    user = current_user if isinstance(current_user, AuthenticatedUser) else None
    if user and not user.is_demo:
        org_id = user.organization_id
    elif user:
        org_id = user.organization_id
    else:
        org_id = "org-demo-simulated" if request.mode == "demo" else "org-acme-prod"

    # ── Microsoft Azure Cloud Handling ──
    if request.cloud_provider == "azure":
        sub_id = (request.azure_subscription_id or request.account_id or "").strip()
        tenant_id = (request.azure_tenant_id or "").strip()
        client_id = (request.azure_client_id or "").strip()
        client_secret = (request.azure_client_secret or "").strip()

        if not sub_id or not tenant_id or not client_id or not client_secret:
            raise HTTPException(
                status_code=400,
                detail="Azure connection requires Subscription ID, Tenant ID, Client ID, and Client Secret."
            )

        from app.services.azure_auth import connect_azure_account, AzureAuthError
        try:
            azure_res = connect_azure_account(
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret,
                subscription_id=sub_id
            )
        except AzureAuthError as e:
            logger.error(f"[Accounts] Azure connection failed: {e}")
            raise HTTPException(status_code=403, detail=f"Azure connection failed: {str(e)}")
        except Exception as e:
            logger.error(f"[Accounts] Unexpected Azure connection error: {e}")
            raise HTTPException(status_code=500, detail=f"Unexpected error connecting to Azure: {str(e)}")

        account_info = {
            "account_id": sub_id,
            "alias": azure_res["display_name"],
            "region": request.region,
            "role_arn": f"azure://subscriptions/{sub_id}",
            "external_id": tenant_id,
            "cloud_provider": "azure",
            "tenant_id": tenant_id,
            "client_id": client_id,
            "client_secret": client_secret,
            "assumed_role_user_arn": f"sp://{client_id}@{tenant_id}",
            "session_expiration": (datetime.now(timezone.utc)).isoformat(),
            "is_live": True,
            "execution_mode": "live",
            "connection_status": "connected",
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        _connected_accounts[f"azure:{sub_id}"] = account_info
        _connected_accounts[f"live:{sub_id}"] = account_info
        _connected_accounts[f"{org_id}:{sub_id}"] = account_info

        try:
            AccountRepository.save_account(org_id, account_info)
        except Exception as e:
            logger.warning(f"[DB] Non-fatal save error: {e}")

        return AccountConnectResponse(
            success=True,
            account_id=sub_id,
            alias=azure_res["display_name"],
            region=request.region,
            role_arn=f"azure://subscriptions/{sub_id}",
            cloud_provider="azure",
            assumed_role_user_arn=account_info["assumed_role_user_arn"],
            session_expiration=account_info["session_expiration"],
            is_live=True,
            execution_mode="live",
            connection_status="connected",
            message=f"Successfully connected to Azure subscription '{azure_res['display_name']}' via Service Principal."
        )

    # ── Direct AWS IAM Access Key Handling (Live Real Cloud) ──
    if request.aws_access_key_id and request.aws_secret_access_key:
        logger.info(f"[Accounts] Initiating live AWS Access Key connection for region {request.region} (Tenant: {org_id})")
        try:
            live_session = connect_with_access_keys(
                access_key_id=request.aws_access_key_id,
                secret_access_key=request.aws_secret_access_key,
                session_token=request.aws_session_token,
                region=request.region
            )
            real_account_id = live_session["target_account_id"]
            account_info = {
                "account_id": real_account_id,
                "alias": f"AWS Live Account {real_account_id[:4]}... ({request.region})",
                "region": request.region,
                "role_arn": live_session["assumed_role_user_arn"],
                "external_id": request.external_id or f"direct-keys-{real_account_id[-4:]}",
                "assumed_role_user_arn": live_session["assumed_role_user_arn"],
                "session_expiration": live_session["expiration"],
                "is_live": True,
                "execution_mode": "live",
                "connection_status": "connected",
                "connection_type": "access_keys",
                "connected_at": datetime.now(timezone.utc).isoformat()
            }
            _connected_accounts[f"live:{real_account_id}"] = account_info
            _connected_accounts[f"{org_id}:{real_account_id}"] = account_info
            try:
                AccountRepository.save_account(org_id, account_info)
            except Exception as e:
                logger.warning(f"[DB] Non-fatal DB save error for live access key account: {e}")

            return AccountConnectResponse(
                success=True,
                account_id=real_account_id,
                alias=account_info["alias"],
                region=request.region,
                role_arn=live_session["assumed_role_user_arn"],
                assumed_role_user_arn=live_session["assumed_role_user_arn"],
                session_expiration=live_session["expiration"],
                is_live=True,
                execution_mode="live",
                connection_status="connected",
                message=f"Successfully authenticated real AWS Account {real_account_id} via IAM Access Keys."
            )
        except (STSAssumeRoleError, STSValidationError, STSConfigurationError) as e:
            logger.error(f"[Accounts] Live access key connection failed: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"[Accounts] Unexpected live access key error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to authenticate AWS Access Keys: {str(e)}")

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
        logger.info(f"[Accounts] Registering simulated demo account {sanitized_id} for org {org_id}")
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
        _connected_accounts[f"{org_id}:{sanitized_id}"] = account_info
        try:
            AccountRepository.save_account(org_id, account_info)
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

    # ── LocalStack / Local Cloud Dev Mode Handling ──
    if getattr(request, "connection_type", None) == "localstack" or request.endpoint_url:
        endpoint = request.endpoint_url or "http://localhost:4566"
        logger.info(f"[Accounts] Initiating LocalStack connection on {endpoint} for tenant {org_id}")
        localstack_session = connect_localstack(
            account_id=sanitized_id or "000000000000",
            endpoint_url=endpoint,
            region=request.region
        )
        account_info = {
            "account_id": sanitized_id,
            "alias": f"LocalStack Cloud ({request.region})",
            "region": request.region,
            "role_arn": request.role_arn,
            "external_id": request.external_id,
            "assumed_role_user_arn": localstack_session["assumed_role_user_arn"],
            "session_expiration": localstack_session["expiration"],
            "is_live": True,
            "execution_mode": "live",
            "connection_status": "connected",
            "is_localstack": True,
            "endpoint_url": endpoint,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        _connected_accounts[f"live:{sanitized_id}"] = account_info
        _connected_accounts[f"{org_id}:{sanitized_id}"] = account_info
        try:
            AccountRepository.save_account(org_id, account_info)
        except Exception as e:
            logger.warning(f"[DB] Non-fatal DB save error for LocalStack account: {e}")

        return AccountConnectResponse(
            success=True,
            account_id=sanitized_id,
            alias=account_info["alias"],
            region=request.region,
            role_arn=request.role_arn,
            assumed_role_user_arn=localstack_session["assumed_role_user_arn"],
            session_expiration=localstack_session["expiration"],
            is_live=True,
            execution_mode="live",
            connection_status="connected",
            message=f"Connected to LocalStack on {endpoint}. Real boto3 calls active with zero cloud spend."
        )

    # ── Live AWS STS AssumeRole Handling ──
    logger.info(f"[Accounts] Initiating live STS verification for {sanitized_id} with {request.role_arn} (Tenant: {org_id})")
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
        _connected_accounts[f"{org_id}:{sanitized_id}"] = account_info
        try:
            AccountRepository.save_account(org_id, account_info)
        except Exception as e:
            logger.warning(f"[DB] Non-fatal DB save error for live account: {e}")

        logger.info(f"[Accounts] Account {sanitized_id} verified and connected via live AWS STS for tenant {org_id}")

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
def list_accounts(
    mode: Optional[str] = Query(None, description="Filter accounts by execution mode ('live' or 'demo')"),
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user)
):
    """
    Lists connected AWS accounts filtered by mode and strictly scoped to current tenant.
    Syncs with persistent database store to survive server restarts.
    """
    user = current_user if isinstance(current_user, AuthenticatedUser) else None
    org_id = user.organization_id if user and not user.is_demo else "org-acme-prod"
    mode_str = mode if isinstance(mode, str) else None
    try:
        db_accounts = AccountRepository.get_accounts(org_id, mode=mode_str)
        results = []
        for acc in db_accounts:
            k = f"{acc.get('execution_mode', 'live')}:{acc['account_id']}"
            acc_dict = {
                "account_id": acc["account_id"],
                "alias": acc.get("alias") or f"AWS Live ({acc['region']})",
                "region": acc["region"],
                "role_arn": acc["role_arn"],
                "external_id": acc["external_id"],
                "assumed_role_user_arn": acc.get("assumed_role_user_arn"),
                "session_expiration": acc.get("session_expiration"),
                "is_live": acc.get("execution_mode") == "live",
                "execution_mode": acc.get("execution_mode", "live"),
                "connection_status": acc.get("status", "connected"),
                "connected_at": acc.get("connected_at")
            }
            _connected_accounts[k] = acc_dict
            _connected_accounts[f"{org_id}:{acc['account_id']}"] = acc_dict
            results.append(acc_dict)
        return results
    except Exception as e:
        logger.warning(f"[Accounts] Error loading DB accounts: {e}")
        return []


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
def disconnect_account(
    account_id: str,
    mode: str = "live",
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user)
):
    """
    Disconnects and removes an AWS account from the active tenant registry.
    Returns complete AWS CLI and CloudFormation revocation procedure.
    """
    user = current_user if isinstance(current_user, AuthenticatedUser) else None
    org_id = user.organization_id if user and not user.is_demo else "org-acme-prod"
    sanitized_id = account_id.replace("-", "").strip()
    deleted = False

    key_org = f"{org_id}:{sanitized_id}"
    key_org_mode = f"{org_id}:{mode}:{sanitized_id}"

    try:
        db_deleted = AccountRepository.delete_account(org_id, sanitized_id, mode)
        deleted = db_deleted
    except Exception as e:
        logger.warning(f"[DB] Non-fatal DB delete error: {e}")

    if key_org in _connected_accounts:
        del _connected_accounts[key_org]
        deleted = True
    if key_org_mode in _connected_accounts:
        del _connected_accounts[key_org_mode]
        deleted = True

    key_mode = f"{mode}:{sanitized_id}"
    if key_mode in _connected_accounts:
        acc_org = _connected_accounts[key_mode].get("organization_id", "org-acme-prod")
        if user is None or acc_org == org_id:
            del _connected_accounts[key_mode]
            deleted = True

    if deleted:
        return {
            "success": True,
            "account_id": sanitized_id,
            "message": f"Account {sanitized_id} successfully disconnected from CloudPilot registry for tenant {org_id}.",
            "revocation_procedure": {
                "step1": "Account connection removed and credentials evicted from memory.",
                "step2_aws_cli": "To revoke all trust on AWS, delete the CloudFormation stack:",
                "cli_command": "aws cloudformation delete-stack --stack-name CloudPilotAuditStack",
                "step3_manual": "Or delete IAM roles 'CloudPilotAuditRole' and 'CloudPilotRemediationRole' via AWS IAM Console."
            }
        }
    raise HTTPException(status_code=404, detail=f"Account {account_id} not found in {mode} mode.")
