import os
import re
import time
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError, EndpointConnectionError
except ImportError:
    boto3 = None
    ClientError = Exception
    NoCredentialsError = Exception
    PartialCredentialsError = Exception
    EndpointConnectionError = Exception

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cloudpilot.sts")

class STSError(Exception):
    """Base class for STS exceptions in CloudPilot."""
    pass

class STSConfigurationError(STSError):
    """Raised when CloudPilot operator AWS credentials or boto3 library are unavailable."""
    pass

class STSValidationError(STSError):
    """Raised when Role ARN or Account ID formatting is invalid."""
    pass

class STSAssumeRoleError(STSError):
    """Raised when AWS STS AssumeRole fails due to permissions, trust policy, or invalid external ID."""
    pass

class STSAccountMismatchError(STSError):
    """Raised when assumed identity account does not match customer's intended account."""
    pass

class STSSessionCache:
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        entry = self._cache.get(key)
        if not entry:
            return None
        # Invalidate 5 minutes before actual token expiry
        if entry["expiration"] - time.time() < 300:
            del self._cache[key]
            return None
        return entry["credentials"]

    def set(self, key: str, credentials: Dict[str, Any], expiration_epoch: float):
        self._cache[key] = {
            "credentials": credentials,
            "expiration": expiration_epoch
        }

    def clear(self):
        self._cache.clear()

session_cache = STSSessionCache()

ROLE_ARN_REGEX = re.compile(r"^arn:aws[a-zA-Z-]*:iam::(\d{12}):role/([\w+=,.@-]+)$")

RETRYABLE_ERROR_CODES = {
    "Throttling",
    "ThrottlingException",
    "RequestLimitExceeded",
    "ServiceUnavailable",
    "SlowDown"
}

def validate_role_arn(role_arn: str, expected_account_id: Optional[str] = None) -> str:
    """
    Validates IAM Role ARN format and ensures target account ID matches expected account.
    Returns extracted account_id on success.
    """
    if not role_arn or not isinstance(role_arn, str):
        raise STSValidationError("Role ARN must be a non-empty string.")

    match = ROLE_ARN_REGEX.match(role_arn.strip())
    if not match:
        raise STSValidationError(
            f"Invalid Role ARN format: '{role_arn}'. Expected format: 'arn:aws:iam::<12-digit-account-id>:role/<role-name>'."
        )
    extracted_account = match.group(1)
    if expected_account_id:
        sanitized_expected = expected_account_id.replace("-", "").strip()
        if extracted_account != sanitized_expected:
            raise STSAccountMismatchError(
                f"Role ARN account ID ({extracted_account}) does not match target account ID ({sanitized_expected})."
            )
    return extracted_account

def assume_role(
    role_arn: str,
    external_id: str,
    session_name: Optional[str] = None,
    region: str = "ap-south-1",
    expected_account_id: Optional[str] = None,
    max_retries: int = 2
) -> Dict[str, Any]:
    """
    Live AWS STS AssumeRole handshake with bounded retries and independent identity verification.
    FAILS CLOSED: Never returns synthetic or simulated credentials on live paths.
    Validates returned temporary credentials using STS GetCallerIdentity before acceptance.
    """
    target_account = validate_role_arn(role_arn, expected_account_id)
    
    if not external_id or len(external_id.strip()) < 4:
        raise STSValidationError("ExternalId must be a non-empty string with sufficient entropy (min 4 characters).")

    cache_key = f"{role_arn}|{external_id}|{region}"
    cached = session_cache.get(cache_key)
    if cached:
        logger.info(f"[STS] Reusing cached verified session token for {role_arn}")
        return cached

    if boto3 is None:
        raise STSConfigurationError("AWS SDK (boto3) is not installed in runtime environment.")

    # Generate unique session name to prevent session collision
    unique_suffix = uuid.uuid4().hex[:8]
    base_session = (session_name or "CloudPilotAudit")[:50]
    effective_session_name = f"{base_session}-{unique_suffix}"

    logger.info(f"[STS] Initiating live AssumeRole for {role_arn} [session={effective_session_name}] in {region}")

    sts_client = boto3.client("sts", region_name=region)

    # 1. Verify operator identity before assuming role
    try:
        operator_identity = sts_client.get_caller_identity()
        logger.info(f"[STS] Operator identity verified: {operator_identity.get('Arn')}")
    except (NoCredentialsError, PartialCredentialsError) as e:
        raise STSConfigurationError(
            "CloudPilot host environment has no valid AWS credentials configured to initiate STS AssumeRole."
        ) from e
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "Unknown")
        msg = e.response.get("Error", {}).get("Message", str(e))
        raise STSConfigurationError(f"CloudPilot AWS operator authentication failed ({code}): {msg}") from e

    # 2. AssumeRole with bounded exponential backoff on transient errors
    attempt = 0
    last_error: Optional[Exception] = None

    while attempt <= max_retries:
        try:
            response = sts_client.assume_role(
                RoleArn=role_arn,
                RoleSessionName=effective_session_name,
                ExternalId=external_id,
                DurationSeconds=3600
            )

            creds = response["Credentials"]
            assumed_user = response.get("AssumedRoleUser", {})
            assumed_arn = assumed_user.get("Arn", "")

            # 3. Independent identity verification of assumed credentials via GetCallerIdentity
            assumed_sts_client = boto3.client(
                "sts",
                region_name=region,
                aws_access_key_id=creds["AccessKeyId"],
                aws_secret_access_key=creds["SecretAccessKey"],
                aws_session_token=creds["SessionToken"]
            )
            assumed_identity = assumed_sts_client.get_caller_identity()
            assumed_account = assumed_identity.get("Account")
            verified_arn = assumed_identity.get("Arn")

            if assumed_account != target_account:
                raise STSAccountMismatchError(
                    f"Assumed identity account '{assumed_account}' does not match expected target account '{target_account}'."
                )

            exp_epoch = creds["Expiration"].timestamp()
            result = {
                "access_key_id": creds["AccessKeyId"],
                "secret_access_key": creds["SecretAccessKey"],
                "session_token": creds["SessionToken"],
                "expiration": creds["Expiration"].isoformat(),
                "assumed_role_user_arn": verified_arn or assumed_arn,
                "target_account_id": target_account,
                "is_simulated": False,
                "execution_mode": "live",
                "verified_at": datetime.now(timezone.utc).isoformat()
            }
            session_cache.set(cache_key, result, exp_epoch)
            logger.info(f"[STS] AssumeRole and GetCallerIdentity verified for {role_arn} (assumed: {verified_arn})")
            return result

        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "Unknown")
            msg = e.response.get("Error", {}).get("Message", str(e))

            if code in RETRYABLE_ERROR_CODES and attempt < max_retries:
                attempt += 1
                backoff = 0.2 * (2 ** attempt)
                logger.warning(f"[STS] Retryable error ({code}) on attempt {attempt}/{max_retries}. Backing off {backoff:.2f}s...")
                time.sleep(backoff)
                last_error = e
                continue

            logger.error(f"[STS] Live AssumeRole failed with AWS ClientError [{code}]: {msg}")
            raise STSAssumeRoleError(
                f"AWS STS AssumeRole rejected [{code}]: {msg}. Ensure CloudPilot role trust policy includes correct ExternalId and operator principal."
            ) from e

        except EndpointConnectionError as e:
            if attempt < max_retries:
                attempt += 1
                backoff = 0.3 * (2 ** attempt)
                logger.warning(f"[STS] Network error on attempt {attempt}/{max_retries}. Backing off {backoff:.2f}s...")
                time.sleep(backoff)
                last_error = e
                continue
            logger.error(f"[STS] Network error communicating with AWS STS in {region}: {e}")
            raise STSAssumeRoleError(f"Network error communicating with AWS STS endpoint in region {region}: {e}") from e

    raise STSAssumeRoleError(f"AssumeRole failed after {max_retries} retries: {last_error}")

def generate_demo_sts_session(
    account_id: str = "123456789012",
    role_arn: Optional[str] = None,
    session_name: str = "CloudPilotDemoSession",
    region: str = "ap-south-1"
) -> Dict[str, Any]:
    """
    Dedicated demo mode fixture generator.
    Explicitly labeled as simulated with execution_mode='demo'.
    NEVER invoked on live execution paths.
    """
    sanitized_id = account_id.replace("-", "").strip()
    effective_role = role_arn or f"arn:aws:iam::{sanitized_id}:role/CloudPilotAuditRole"
    now = datetime.now(timezone.utc)
    expiration = now + timedelta(hours=1)

    return {
        "access_key_id": "ASIA-DEMO-SIMULATED-KEY",
        "secret_access_key": "DEMO-SIMULATED-SECRET",
        "session_token": "DEMO-SIMULATED-SESSION-TOKEN",
        "expiration": expiration.isoformat(),
        "assumed_role_user_arn": f"arn:aws:sts::{sanitized_id}:assumed-role/CloudPilotAuditRole/{session_name}",
        "target_account_id": sanitized_id,
        "is_simulated": True,
        "execution_mode": "demo"
    }

def get_ec2_client(credentials: Dict[str, Any], region: str = "ap-south-1"):
    """
    Returns a live boto3 EC2 client initialized with assumed temporary STS credentials.
    Refuses simulated credentials. Returns None if credentials are simulated or boto3 is unavailable.
    """
    if not boto3 or not credentials or credentials.get("is_simulated", False):
        return None
    
    if "access_key_id" not in credentials or "secret_access_key" not in credentials:
        return None
    
    return boto3.client(
        "ec2",
        region_name=region,
        aws_access_key_id=credentials["access_key_id"],
        aws_secret_access_key=credentials["secret_access_key"],
        aws_session_token=credentials.get("session_token")
    )
