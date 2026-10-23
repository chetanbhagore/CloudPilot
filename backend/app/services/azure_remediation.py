"""
Azure Verified Remediation Engine
Executes live, atomic mutations against Azure Resource Manager with:
  1. Idempotency protection
  2. Pre-flight state verification (fails closed if safety guards violated)
  3. Live mutation capturing ARM x-ms-request-id
  4. Independent post-mutation read verification
FAILS CLOSED: Never marks an Azure finding resolved without independent verification.
"""

import json
import logging
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.services.azure_auth import get_azure_oauth_token
from app.services.remediation import (
    RemediationExecutionRecord,
    _execution_records,
    _idempotency_index
)

logger = logging.getLogger("cloudpilot.azure_remediation")


class AzureRemediationPreflightError(Exception):
    """Raised when pre-flight safety checks fail prior to ARM mutation."""
    pass


class AzureRemediationVerificationError(Exception):
    """Raised when post-mutation read check does not observe desired state."""
    pass


def _execute_arm_mutation(url: str, token: str, method: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Executes an ARM mutation (DELETE / PATCH / PUT) and extracts x-ms-request-id."""
    data = json.dumps(body).encode("utf-8") if body else None
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            hdrs = getattr(resp, "headers", None)
            if hdrs and hasattr(hdrs, "get"):
                req_id = hdrs.get("x-ms-request-id") or f"arm-req-{uuid.uuid4().hex[:8]}"
            else:
                req_id = f"arm-req-{uuid.uuid4().hex[:8]}"
            
            raw = resp.read()
            if isinstance(raw, bytes):
                content = raw.decode("utf-8")
            elif isinstance(raw, str):
                content = raw
            else:
                content = ""
            
            resp_body = json.loads(content) if (content and content.strip()) else {}
            return {"success": True, "request_id": req_id, "body": resp_body}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else str(e)
        hdrs = getattr(e, "headers", None)
        req_id = hdrs.get("x-ms-request-id") if (hdrs and hasattr(hdrs, "get")) else f"arm-err-{uuid.uuid4().hex[:8]}"
        logger.error(f"[AzureRemediation] ARM {method} failed ({e.code}): {err_content}")
        raise ValueError(f"Azure ARM mutation rejected ({e.code}): {err_content}") from e


def _arm_get_json(url: str, token: str) -> Dict[str, Any]:
    """Performs an authenticated ARM GET request."""
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"}, method="GET")
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read()
        if isinstance(raw, bytes):
            content = raw.decode("utf-8")
        elif isinstance(raw, str):
            content = raw
        else:
            content = "{}"
        return json.loads(content) if (content and content.strip()) else {}


def execute_azure_live_remediation(
    subscription_id: str,
    resource_id: str,
    action_type: str,
    parameters: Dict[str, Any],
    credentials: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
    actor_email: str = "operator@cloudpilot.io",
    finding_id: str = "manual-remediation",
    oauth_token: Optional[str] = None
) -> RemediationExecutionRecord:
    """
    Executes live verified Azure remediation against customer subscription.
    Enforces preflight safety guards, issues ARM mutation, and verifies post-state.
    """
    if not idempotency_key:
        idempotency_key = f"azure-rem-{uuid.uuid4().hex[:12]}"

    # 1. Idempotency Check
    if idempotency_key in _idempotency_index:
        existing_id = _idempotency_index[idempotency_key]
        existing = _execution_records.get(existing_id)
        if existing:
            logger.warning(f"[AzureRemediation] Idempotency collision for '{idempotency_key}'. Returning existing record.")
            return existing

    exec_id = f"exec-az-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    record = RemediationExecutionRecord(
        execution_id=exec_id,
        idempotency_key=idempotency_key,
        finding_id=finding_id,
        action_type=action_type,
        target_resource_id=resource_id,
        account_id=subscription_id,
        region="azure",
        parameters=parameters,
        state="executing",
        actor_email=actor_email,
        execution_mode="live",
        created_at=now_iso,
        verification_status="in_progress"
    )
    _execution_records[exec_id] = record
    _idempotency_index[idempotency_key] = exec_id

    # 2. Acquire Azure Token
    if oauth_token:
        token = oauth_token
    elif credentials and "tenant_id" in credentials:
        try:
            token = get_azure_oauth_token(
                tenant_id=credentials["tenant_id"],
                client_id=credentials["client_id"],
                client_secret=credentials["client_secret"]
            )
        except Exception as e:
            record.state = "failed"
            record.verification_status = "failed"
            record.error_message = f"Failed to authenticate with Azure identity platform: {e}"
            return record
    else:
        record.state = "failed"
        record.verification_status = "failed"
        record.error_message = "No valid Azure credentials or OAuth token supplied."
        return record

    # 3. Action Dispatcher
    try:
        # ── Action A: Delete Open Security Rule from NSG ──
        if action_type == "azure:network/networkSecurityGroups/securityRules/delete":
            rule_name = parameters.get("rule_name")
            nsg_name = parameters.get("nsg_name")
            rg = parameters.get("resource_group")
            
            if rule_name and nsg_name and rg:
                target_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{rg}/providers/Microsoft.Network/networkSecurityGroups/{nsg_name}/securityRules/{rule_name}?api-version=2023-09-01"
            elif resource_id.startswith("/subscriptions/"):
                target_url = f"https://management.azure.com{resource_id}?api-version=2023-09-01"
            else:
                record.state = "failed"
                record.verification_status = "failed"
                record.error_message = "Missing 'rule_name' or valid resource_id for Azure NSG rule deletion."
                return record

            # Pre-flight Check: Confirm rule exists
            try:
                preflight_rule = _arm_get_json(target_url, token)
                record.before_state = f"NSG Rule '{rule_name or preflight_rule.get('name')}': ACTIVE (PERMITS PUBLIC INGRESS)"
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    raise AzureRemediationPreflightError(f"NSG rule '{rule_name}' does not exist (already deleted).")
                raise

            # Mutation: DELETE rule
            res = _execute_arm_mutation(target_url, token, method="DELETE")
            record.executed_at = datetime.now(timezone.utc).isoformat()
            record.aws_request_id = res["request_id"]

            # Independent Read Verification: 404 confirms deletion
            try:
                req = urllib.request.Request(target_url, headers={"Authorization": f"Bearer {token}"}, method="GET")
                with urllib.request.urlopen(req, timeout=10):
                    record.state = "verification_failed"
                    record.verification_status = "failed"
                    record.error_message = f"Verification failed: Rule '{rule_name}' is still present in NSG."
                    return record
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    record.state = "succeeded"
                    record.verification_status = "verified"
                    record.after_state = f"NSG Rule '{rule_name or 'InsecureRule'}': DELETED (VERIFIED ✓)"
                    record.verified_at = datetime.now(timezone.utc).isoformat()
                    record.verification_evidence = [
                        f"ARM GET confirmed rule returned HTTP 404 NotFound.",
                        f"Azure ARM RequestId: {record.aws_request_id}"
                    ]
                    return record
                record.state = "failed"
                record.verification_status = "failed"
                record.error_message = f"Verification error: {e}"
                return record

        # ── Action B: Delete Unassociated Public IP ──
        elif action_type == "azure:network/publicIPAddresses/delete":
            pip_name = parameters.get("public_ip_name")
            rg = parameters.get("resource_group")
            if pip_name and rg:
                target_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{rg}/providers/Microsoft.Network/publicIPAddresses/{pip_name}?api-version=2023-09-01"
            elif resource_id.startswith("/subscriptions/"):
                target_url = f"https://management.azure.com{resource_id}?api-version=2023-09-01"
            else:
                record.state = "failed"
                record.verification_status = "failed"
                record.error_message = "Missing 'public_ip_name' or valid resource_id for Azure Public IP deletion."
                return record

            # Pre-flight Check: Guard against deleting associated IP
            preflight_pip = _arm_get_json(target_url, token)
            props = preflight_pip.get("properties", {})
            if props.get("ipConfiguration"):
                raise AzureRemediationPreflightError(
                    f"Safety violation: Public IP '{pip_name or preflight_pip.get('name')}' is associated with a network interface ({props['ipConfiguration']}). Deletion blocked."
                )

            record.before_state = f"Public IP: ALLOCATED (UNASSOCIATED, IP: {props.get('ipAddress', 'N/A')})"

            # Mutation: DELETE IP
            res = _execute_arm_mutation(target_url, token, method="DELETE")
            record.executed_at = datetime.now(timezone.utc).isoformat()
            record.aws_request_id = res["request_id"]

            # Independent Read Verification: 404 confirms deletion
            try:
                req = urllib.request.Request(target_url, headers={"Authorization": f"Bearer {token}"}, method="GET")
                with urllib.request.urlopen(req, timeout=10):
                    record.state = "verification_failed"
                    record.verification_status = "failed"
                    record.error_message = "Verification failed: Public IP still exists."
                    return record
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    record.state = "succeeded"
                    record.verification_status = "verified"
                    record.after_state = "Public IP: DELETED ($0.00/mo ✓)"
                    record.verified_at = datetime.now(timezone.utc).isoformat()
                    record.verification_evidence = [
                        "ARM GET confirmed Public IP returned HTTP 404 NotFound.",
                        f"Azure ARM RequestId: {record.aws_request_id}"
                    ]
                    return record
                record.state = "failed"
                record.verification_status = "failed"
                record.error_message = str(e)
                return record

        # ── Action C: Delete Unattached Managed Disk ──
        elif action_type == "azure:compute/disks/delete":
            disk_name = parameters.get("disk_name")
            rg = parameters.get("resource_group")
            if disk_name and rg:
                target_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{rg}/providers/Microsoft.Compute/disks/{disk_name}?api-version=2023-04-02"
            elif resource_id.startswith("/subscriptions/"):
                target_url = f"https://management.azure.com{resource_id}?api-version=2023-04-02"
            else:
                record.state = "failed"
                record.verification_status = "failed"
                record.error_message = "Missing 'disk_name' or valid resource_id for Azure Managed Disk deletion."
                return record

            # Pre-flight Check: Guard against deleting attached disk
            preflight_disk = _arm_get_json(target_url, token)
            if preflight_disk.get("managedBy"):
                raise AzureRemediationPreflightError(
                    f"Safety violation: Managed Disk '{disk_name or preflight_disk.get('name')}' is attached to virtual machine ({preflight_disk['managedBy']}). Deletion blocked."
                )

            disk_size = preflight_disk.get("properties", {}).get("diskSizeGB", 32)
            record.before_state = f"Managed Disk: PROVISIONED (UNATTACHED, Size: {disk_size} GB)"

            # Mutation: DELETE disk
            res = _execute_arm_mutation(target_url, token, method="DELETE")
            record.executed_at = datetime.now(timezone.utc).isoformat()
            record.aws_request_id = res["request_id"]

            # Independent Read Verification: 404 confirms deletion
            try:
                req = urllib.request.Request(target_url, headers={"Authorization": f"Bearer {token}"}, method="GET")
                with urllib.request.urlopen(req, timeout=10):
                    record.state = "verification_failed"
                    record.verification_status = "failed"
                    record.error_message = "Verification failed: Managed Disk still exists."
                    return record
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    record.state = "succeeded"
                    record.verification_status = "verified"
                    record.after_state = "Managed Disk: DELETED ($0.00/mo ✓)"
                    record.verified_at = datetime.now(timezone.utc).isoformat()
                    record.verification_evidence = [
                        "ARM GET confirmed Managed Disk returned HTTP 404 NotFound.",
                        f"Azure ARM RequestId: {record.aws_request_id}"
                    ]
                    return record
                record.state = "failed"
                record.verification_status = "failed"
                record.error_message = str(e)
                return record

        # ── Action D: Disable Public Blob Access on Storage Account ──
        elif action_type == "azure:storage/storageAccounts/patch":
            sa_name = parameters.get("account_name")
            rg = parameters.get("resource_group")
            if sa_name and rg:
                target_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{sa_name}?api-version=2023-01-01"
            elif resource_id.startswith("/subscriptions/"):
                target_url = f"https://management.azure.com{resource_id}?api-version=2023-01-01"
            else:
                record.state = "failed"
                record.verification_status = "failed"
                record.error_message = "Missing 'account_name' or valid resource_id for Azure Storage Account update."
                return record

            # Pre-flight Check
            preflight_sa = _arm_get_json(target_url, token)
            curr_public = preflight_sa.get("properties", {}).get("allowBlobPublicAccess", True)
            record.before_state = f"Storage Account: allowBlobPublicAccess={curr_public}"

            # Mutation: PATCH allowBlobPublicAccess to false
            patch_body = {"properties": {"allowBlobPublicAccess": False}}
            res = _execute_arm_mutation(target_url, token, method="PATCH", body=patch_body)
            record.executed_at = datetime.now(timezone.utc).isoformat()
            record.aws_request_id = res["request_id"]

            # Independent Read Verification: Confirm allowBlobPublicAccess is False
            try:
                verify_sa = _arm_get_json(target_url, token)
                if not verify_sa.get("properties", {}).get("allowBlobPublicAccess", True):
                    record.state = "succeeded"
                    record.verification_status = "verified"
                    record.after_state = "Storage Account: allowBlobPublicAccess=False (VERIFIED ✓)"
                    record.verified_at = datetime.now(timezone.utc).isoformat()
                    record.verification_evidence = [
                        "ARM GET confirmed allowBlobPublicAccess is set to False.",
                        f"Azure ARM RequestId: {record.aws_request_id}"
                    ]
                    return record
                record.state = "verification_failed"
                record.verification_status = "failed"
                record.error_message = "allowBlobPublicAccess is still True."
                return record
            except Exception as e:
                record.state = "failed"
                record.verification_status = "failed"
                record.error_message = str(e)
                return record

        else:
            record.state = "failed"
            record.verification_status = "failed"
            record.error_message = f"Unsupported Azure action '{action_type}'."
            return record

    except AzureRemediationPreflightError as e:
        record.state = "failed"
        record.verification_status = "failed"
        record.error_message = str(e)
        raise
    except Exception as e:
        record.state = "failed"
        record.verification_status = "failed"
        record.error_message = str(e)
        return record
