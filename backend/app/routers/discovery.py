import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from fastapi import APIRouter, HTTPException, Query
import hashlib
from app.schemas import (
    DiscoveryRequest,
    DiscoveryResponse,
    FindingModel,
    ExecutionMode,
    ApproveRequest,
    ApproveResponse
)
from app.services.aws_sts import assume_role, STSError
from app.services.aws_discovery import scan_account_live, get_demo_scenario_findings
from app.services.remediation import execute_live_remediation
from app.routers.accounts import _connected_accounts

logger = logging.getLogger("cloudpilot.discovery_router")
router = APIRouter(tags=["Discovery & Remediation"])

# In-memory findings cache partitioned by mode
_cached_findings: Dict[str, FindingModel] = {}

# Active in-flight scans lock by account ID
_active_scans: Set[str] = set()

@router.post("/discovery/scan", response_model=DiscoveryResponse)
def run_discovery_scan(request: DiscoveryRequest):
    """
    Triggers targeted AWS discovery scan.
    In live mode: Queries real AWS EC2 & EBS APIs across specified regions via verified STS credentials.
    Supports multi-region scanning, API pagination, and distinguishes completed, empty, partial, and failed scans.
    FAILS CLOSED: Returns zero findings if none exist; never fabricates findings or resource counts.
    """
    sanitized_id = request.account_id.replace("-", "").strip()

    # ── Demo Mode Execution ──
    if request.mode == "demo":
        logger.info(f"[Discovery] Generating simulated demo findings for {sanitized_id} in {request.region}")
        demo_findings = get_demo_scenario_findings("fintech", sanitized_id, request.region)
        for f in demo_findings:
            _cached_findings[f"demo:{f.id}"] = f
        return DiscoveryResponse(
            success=True,
            account_id=sanitized_id,
            region=request.region,
            scanned_at=datetime.now(timezone.utc).isoformat(),
            resource_count=len(demo_findings),
            findings=demo_findings,
            execution_mode="demo",
            scan_status="completed",
            scanned_regions=[request.region],
            failed_regions=[],
            scan_id=f"demo-scan-{uuid.uuid4().hex[:8]}"
        )

    # ── Concurrency Protection ──
    lock_key = f"live:{sanitized_id}"
    if lock_key in _active_scans:
        raise HTTPException(
            status_code=409,
            detail=f"A discovery scan is already active for account {sanitized_id}. Please wait for it to complete."
        )

    account_info = _connected_accounts.get(lock_key)
    if not account_info:
        raise HTTPException(
            status_code=400,
            detail=f"Account {sanitized_id} is not connected in live mode. Perform STS connection via /accounts/connect first."
        )

    role_arn = account_info["role_arn"]
    external_id = account_info["external_id"]
    scan_id = f"scan-{uuid.uuid4().hex[:10]}"
    target_regions = request.regions if request.regions and len(request.regions) > 0 else [request.region]

    _active_scans.add(lock_key)
    try:
        credentials = assume_role(
            role_arn=role_arn,
            external_id=external_id,
            session_name=f"CPScan-{sanitized_id[-4:]}",
            region=request.region,
            expected_account_id=sanitized_id
        )

        discovered_findings, scanned_count, successful_regions, failed_regions, errors = scan_account_live(
            account_id=sanitized_id,
            region=request.region,
            credentials=credentials,
            regions=target_regions,
            scan_id=scan_id
        )

        # Store discovered findings in cache
        for f in discovered_findings:
            _cached_findings[f"live:{f.id}"] = f

        # Determine overall scan status
        if len(failed_regions) > 0 and len(successful_regions) > 0:
            scan_status = "partial"
            error_msg = f"Partial scan failure in regions: {', '.join(failed_regions)}. Errors: {errors}"
        elif len(failed_regions) > 0 and len(successful_regions) == 0:
            scan_status = "failed"
            error_msg = f"Scan failed across all requested regions: {errors}"
        elif len(discovered_findings) == 0:
            scan_status = "empty"
            error_msg = None
        else:
            scan_status = "completed"
            error_msg = None

        logger.info(
            f"[Discovery] Live scan {scan_id} complete for {sanitized_id}: "
            f"{len(discovered_findings)} findings across {scanned_count} resources inspected. Status: {scan_status}"
        )

        return DiscoveryResponse(
            success=scan_status != "failed",
            account_id=sanitized_id,
            region=request.region,
            scanned_at=datetime.now(timezone.utc).isoformat(),
            resource_count=scanned_count,
            findings=discovered_findings,
            execution_mode="live",
            scan_status=scan_status,
            scanned_regions=successful_regions,
            failed_regions=failed_regions,
            error_message=error_msg,
            scan_id=scan_id
        )

    except STSError as e:
        logger.error(f"[Discovery] STS authentication failed during live scan: {e}")
        raise HTTPException(status_code=403, detail=f"AWS STS error during scan: {str(e)}")
    except Exception as e:
        logger.error(f"[Discovery] Live scan encountered fatal error: {e}")
        raise HTTPException(status_code=502, detail=f"Live AWS scan failed: {str(e)}")
    finally:
        _active_scans.discard(lock_key)

@router.get("/findings", response_model=List[FindingModel])
def get_findings(
    category: Optional[str] = Query(None, description="Filter by category ('cost' or 'security')"),
    mode: str = Query("live", description="Execution mode ('live' or 'demo')")
):
    """
    Returns discovered findings partitioned by mode.
    FAILS CLOSED: Live mode returns only verified live findings. If cache is empty, returns empty list [].
    Never auto-seeds live mode with demo data.
    """
    mode_str = mode if isinstance(mode, str) else "live"
    prefix = f"{mode_str}:"
    matching = [
        f for k, f in _cached_findings.items()
        if k.startswith(prefix) and f.execution_mode == mode_str
    ]

    # In demo mode only, seed if empty
    if mode_str == "demo" and not matching:
        seeds = get_demo_scenario_findings("fintech", "123456789012", "ap-south-1")
        for s in seeds:
            _cached_findings[f"demo:{s.id}"] = s
        matching = seeds

    category_str = category if isinstance(category, str) else None
    if category_str:
        matching = [f for f in matching if f.category == category_str]
    return matching

@router.get("/findings/{finding_id}", response_model=FindingModel)
def get_finding_by_id(
    finding_id: str,
    mode: str = Query("live", description="Execution mode ('live' or 'demo')")
):
    """
    Returns single finding with full Safety Passport schema by exact ID.
    """
    mode_str = mode if isinstance(mode, str) else "live"
    key = f"{mode_str}:{finding_id}"
    finding = _cached_findings.get(key)
    if not finding:
        # Fallback check without prefix
        finding = _cached_findings.get(finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail=f"Finding '{finding_id}' not found in {mode_str} mode.")
    return finding

@router.post("/findings/{finding_id}/approve", response_model=ApproveResponse)
def approve_finding(finding_id: str, request: Optional[ApproveRequest] = None):
    """
    Executes or records explicit human authorization for a finding's remediation.
    FAILS CLOSED in live mode:
      - Validates finding is not safety-blocked.
      - Dispatches atomic AWS API via temporary credentials.
      - Requires independent read verification before declaring success.
      - A denied API call or verification failure NEVER marks finding as resolved.
    """
    req = request or ApproveRequest()
    mode_str = req.mode

    key = f"{mode_str}:{finding_id}"
    finding = _cached_findings.get(key)
    if not finding:
        finding = _cached_findings.get(finding_id)

    if not finding:
        raise HTTPException(status_code=404, detail=f"Finding '{finding_id}' not found.")

    if finding.isSafetyBlocked:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot authorize remediation: {finding.blockedReason or 'Pre-flight safety check failed.'}"
        )

    actor_email = req.user_email
    now_iso = datetime.now(timezone.utc).isoformat()
    idempotency_key = f"rem-{finding.id}-{finding.resource.id}-{actor_email}"

    # ── Demo Mode Execution ──
    if mode_str == "demo" or finding.execution_mode == "demo":
        record = execute_live_remediation(
            account_id=finding.resource.account_id or "123456789012",
            region=finding.resource.region,
            resource_id=finding.resource.id,
            action_type=finding.operation,
            parameters=finding.operationParams,
            actor_email=actor_email,
            finding_id=finding.id,
            credentials={"is_simulated": True, "execution_mode": "demo"},
            idempotency_key=idempotency_key,
            mode="demo"
        )
        finding.status = "resolved"
        _cached_findings[key] = finding

        canonical_payload = f"{finding.id}|{finding.resource.id}|{now_iso}|{record.aws_request_id}|{actor_email}"
        integrity_hash = hashlib.sha256(canonical_payload.encode()).hexdigest()

        return ApproveResponse(
            success=True,
            finding_id=finding.id,
            action=f"{finding.operation} — {finding.title}",
            resource_id=finding.resource.id,
            outcome="success",
            before_state=record.before_state or finding.beforeState,
            after_state=record.after_state or finding.afterState,
            aws_request_id=record.aws_request_id or f"demo-req-{uuid.uuid4().hex[:8]}",
            canonical_payload=canonical_payload,
            integrity_hash=integrity_hash,
            timestamp=now_iso,
            execution_mode="demo",
            verification_status="verified",
            verified_at=record.verified_at
        )

    # ── Live Mode Execution ──
    account_key = f"live:{finding.resource.account_id or ''}"
    account_info = _connected_accounts.get(account_key)
    if not account_info and finding.resource.account_id:
        account_info = _connected_accounts.get(f"live:{finding.resource.account_id.replace('-', '')}")

    if not account_info:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot execute live remediation: Target AWS account for {finding.resource.id} is not connected."
        )

    # Assume Remediation Role (Role 2) with atomic write permissions
    audit_role_arn = account_info["role_arn"]
    rem_role_arn = audit_role_arn.replace("CloudPilotAuditRole", "CloudPilotRemediationRole")
    external_id = account_info["external_id"]

    try:
        credentials = assume_role(
            role_arn=rem_role_arn,
            external_id=external_id,
            session_name=f"CPRem-{finding.resource.id[:8]}",
            region=finding.resource.region,
            expected_account_id=account_info["account_id"]
        )

        record = execute_live_remediation(
            account_id=account_info["account_id"],
            region=finding.resource.region,
            resource_id=finding.resource.id,
            action_type=finding.operation,
            parameters=finding.operationParams,
            actor_email=actor_email,
            finding_id=finding.id,
            credentials=credentials,
            idempotency_key=idempotency_key,
            mode="live"
        )

        canonical_payload = f"{finding.id}|{finding.resource.id}|{now_iso}|{record.aws_request_id or 'none'}|{actor_email}"
        integrity_hash = hashlib.sha256(canonical_payload.encode()).hexdigest()

        # ONLY update finding to resolved if verification SUCCEEDED!
        if record.state == "succeeded":
            finding.status = "resolved"
            _cached_findings[key] = finding
            return ApproveResponse(
                success=True,
                finding_id=finding.id,
                action=f"{finding.operation} — {finding.title}",
                resource_id=finding.resource.id,
                outcome="success",
                before_state=record.before_state or finding.beforeState,
                after_state=record.after_state or finding.afterState,
                aws_request_id=record.aws_request_id or "unknown",
                canonical_payload=canonical_payload,
                integrity_hash=integrity_hash,
                timestamp=now_iso,
                execution_mode="live",
                verification_status="verified",
                verified_at=record.verified_at
            )
        else:
            # Execution or verification failed — DO NOT resolve finding!
            return ApproveResponse(
                success=False,
                finding_id=finding.id,
                action=f"{finding.operation} — {finding.title}",
                resource_id=finding.resource.id,
                outcome=record.state,
                before_state=record.before_state or finding.beforeState,
                after_state=finding.beforeState,
                aws_request_id=record.aws_request_id or "none",
                canonical_payload=canonical_payload,
                integrity_hash=integrity_hash,
                timestamp=now_iso,
                execution_mode="live",
                verification_status="failed",
                error_details=record.error_message
            )

    except STSError as e:
        logger.error(f"[Approve] Remediation AssumeRole rejected: {e}")
        raise HTTPException(status_code=403, detail=f"Failed to assume Remediation Role: {str(e)}")
    except Exception as e:
        logger.error(f"[Approve] Remediation error: {e}")
        raise HTTPException(status_code=500, detail=f"Remediation error: {str(e)}")

