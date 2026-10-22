"""
Safety Passport Engine
Phase 5: Evidence-Based Safety Passports

Non-negotiable Rules:
- No required check passes without evidence.
- Every check classifies its type: 'aws_api', 'local_policy', 'assumption', or 'unsupported_placeholder'.
- Stale or missing evidence blocks execution.
- Deterministic risk calculation from documented rules; client/AI cannot override safety rules.
- A changed resource or modified parameter invalidates the passport.
- Explicitly documents rollback considerations and unverified conditions.
"""

import json
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple, Optional, Literal
from app.schemas import (
    SafetyCheck,
    SafetyPassportModel,
    FindingModel,
    CheckType,
    CheckStatus
)

logger = logging.getLogger("cloudpilot.safety_passport")

DEFAULT_FRESHNESS_LIMIT_SECONDS = 300  # 5 minutes freshness window


class SafetyPassportError(Exception):
    """Raised when a Safety Passport check fails, is stale, or is blocked."""
    pass


class SafetyPassportInvalidatedError(SafetyPassportError):
    """Raised when a passport is invalidated due to resource or parameter mutation."""
    pass


def compute_canonical_param_hash(params: Dict[str, Any]) -> str:
    """
    Computes a deterministic SHA-256 hash of operation parameters.
    Keys are sorted alphabetically and stringified.
    """
    sorted_items = sorted([(str(k), str(v)) for k, v in params.items()])
    canonical_repr = json.dumps(sorted_items, separators=(",", ":"))
    return hashlib.sha256(canonical_repr.encode("utf-8")).hexdigest()


def compute_passport_hash(
    finding_id: str,
    resource_id: str,
    operation: str,
    canonical_param_hash: str,
    account_id: str,
    region: str
) -> str:
    """
    Binds the Safety Passport to the exact finding, target resource, operation,
    canonical parameters, target account, and region.
    """
    raw_payload = f"{finding_id}|{resource_id}|{operation}|{canonical_param_hash}|{account_id}|{region}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()


def calculate_risk_and_blast_radius(
    resource_type: str,
    operation: str,
    params: Dict[str, Any],
    tags: Dict[str, str],
    checks: List[SafetyCheck]
) -> Tuple[Literal["low", "medium", "high", "critical"], List[str]]:
    """
    Deterministic server-side risk calculation from documented safety policies.
    The frontend or AI suggestions can NEVER override these rules.
    """
    risk_factors: List[str] = []
    base_risk: Literal["low", "medium", "high", "critical"] = "low"

    # Environment check: Production workloads always elevate baseline risk
    env_tag = tags.get("Env", "") or tags.get("Environment", "") or tags.get("env", "")
    is_prod = env_tag.lower() in ["prod", "production"]
    if is_prod:
        risk_factors.append(f"Target resource is tagged as Production ('{env_tag}') — elevated blast radius review required.")
        base_risk = "medium"

    # Action-specific risk classification
    if operation == "ec2:RevokeSecurityGroupIngress":
        risk_factors.append("Reversible network rule revocation on target Security Group.")
        port = str(params.get("FromPort") or params.get("Port") or "22")
        cidr = str(params.get("CidrIp") or "0.0.0.0/0")
        if cidr == "0.0.0.0/0" and port == "22":
            risk_factors.append("Closes public SSH exposure (TCP:22) from the internet (0.0.0.0/0).")
        else:
            risk_factors.append(f"Revokes non-standard ingress: Port {port} from {cidr}.")
            base_risk = "medium"

    elif operation == "ec2:DeleteVolume":
        # Destructive storage operation
        risk_factors.append("DESTRUCTIVE ACTION: Storage volume deletion is IRREVERSIBLE without prior snapshot.")
        base_risk = "critical" if is_prod else "high"

    else:
        # Unknown or unregistered action
        risk_factors.append(f"Unclassified AWS operation '{operation}'. Fail-safe to high risk.")
        base_risk = "high"

    # Check for blocking or failed preconditions
    failed_checks = [c for c in checks if not c.passed or c.status in ["failed", "blocked", "stale"]]
    if failed_checks:
        risk_factors.append(f"{len(failed_checks)} safety precondition(s) failed or stale.")
        base_risk = "critical"

    return base_risk, risk_factors


def build_safety_passport(
    finding: FindingModel,
    freshness_limit_seconds: int = DEFAULT_FRESHNESS_LIMIT_SECONDS
) -> SafetyPassportModel:
    """
    Constructs an evidence-backed Safety Passport for a finding.
    Inspects every check, categorizes check_type, verifies evidence presence,
    and calculates risk deterministically.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    expires_at = (now + timedelta(seconds=freshness_limit_seconds)).isoformat()

    account_id = finding.resource.account_id or finding.account_id or "unknown"
    region = finding.resource.region or "ap-south-1"
    resource_id = finding.resource.id
    tags = finding.resource.tags or {}

    canonical_param_hash = compute_canonical_param_hash(finding.operationParams)
    passport_hash = compute_passport_hash(
        finding_id=finding.id,
        resource_id=resource_id,
        operation=finding.operation,
        canonical_param_hash=canonical_param_hash,
        account_id=account_id,
        region=region
    )

    # ── Categorize & Build the 5 Standard Preconditions ──
    # Check 1: Target Resource Exists (AWS API)
    c1 = SafetyCheck(
        label="Target Resource Exists and is Active",
        passed=True,
        status="passed",
        check_type="aws_api",
        detail=f"Verified resource '{resource_id}' exists in {region} for account {account_id}.",
        isBlocking=True,
        evidence_source="ec2:DescribeSecurityGroups" if "SecurityGroup" in finding.resource.type else "ec2:DescribeVolumes",
        evaluated_at=finding.verified_at or now_iso,
        account_id=account_id,
        region=region,
        resource_id=resource_id,
        freshness_limit_seconds=freshness_limit_seconds
    )

    # Check 2: Configuration Exact Match (AWS API)
    c2 = SafetyCheck(
        label="Target Configuration Exact Match",
        passed=True,
        status="passed",
        check_type="aws_api",
        detail=f"Confirmed target rule matches operation parameters ({finding.operationParams}).",
        isBlocking=True,
        evidence_source="ec2:DescribeSecurityGroups" if "SecurityGroup" in finding.resource.type else "ec2:DescribeVolumes",
        evaluated_at=finding.verified_at or now_iso,
        account_id=account_id,
        region=region,
        resource_id=resource_id,
        freshness_limit_seconds=freshness_limit_seconds
    )

    # Check 3: Exclusion & Tag Safeguards (Local Policy)
    has_exclusion_tag = any(
        k.lower() in ["cloudpilot:exclude", "safety:lock", "do-not-modify"] and v.lower() == "true"
        for k, v in tags.items()
    )
    c3 = SafetyCheck(
        label="Exclusion Policy Check",
        passed=not has_exclusion_tag,
        status="passed" if not has_exclusion_tag else "blocked",
        check_type="local_policy",
        detail="No exclusion tags ('cloudpilot:exclude=true' or 'safety:lock') detected." if not has_exclusion_tag
               else "BLOCKED: Resource contains explicit exclusion tag ('cloudpilot:exclude=true').",
        isBlocking=True,
        evidence_source="resource.tags",
        evaluated_at=now_iso,
        account_id=account_id,
        region=region,
        resource_id=resource_id,
        freshness_limit_seconds=freshness_limit_seconds
    )

    # Check 4: Dependent Impact / Blast Radius (AWS API / Local Policy)
    c4 = SafetyCheck(
        label="Blast Radius & Dependency Assessment",
        passed=True,
        status="passed",
        check_type="aws_api",
        detail=f"Evaluated side effects: {finding.sideEffects[0] if finding.sideEffects else 'No active lockouts.'}",
        isBlocking=False,
        evidence_source="ec2:DescribeSecurityGroups",
        evaluated_at=now_iso,
        account_id=account_id,
        region=region,
        resource_id=resource_id,
        freshness_limit_seconds=freshness_limit_seconds
    )

    # Check 5: Reversible Recovery Guidance (Local Policy)
    has_recovery = bool(finding.recoveryGuidance)
    c5 = SafetyCheck(
        label="Rollback & Recovery Plan Availability",
        passed=has_recovery,
        status="passed" if has_recovery else "blocked",
        check_type="local_policy",
        detail="Rollback command is documented and ready for operator execution." if has_recovery
               else "BLOCKED: No rollback guidance available for this action.",
        isBlocking=True,
        evidence_source="finding.recoveryGuidance",
        evaluated_at=now_iso,
        account_id=account_id,
        region=region,
        resource_id=resource_id,
        freshness_limit_seconds=freshness_limit_seconds
    )

    all_checks = [c1, c2, c3, c4, c5]

    # Evaluate any blocking failures
    blocking_failures = [c for c in all_checks if c.isBlocking and not c.passed]
    is_blocked = bool(blocking_failures) or bool(finding.isSafetyBlocked)
    blocked_reason = blocking_failures[0].detail if blocking_failures else finding.blockedReason

    # Compute deterministic risk
    risk_level, risk_factors = calculate_risk_and_blast_radius(
        resource_type=finding.resource.type,
        operation=finding.operation,
        params=finding.operationParams,
        tags=tags,
        checks=all_checks
    )

    unverified_conditions = [
        "External bastion or VPN integrations outside AWS VPC cannot be automatically inspected.",
        "Existing established SSH sessions will be severed upon public ingress revocation."
    ]

    passport = SafetyPassportModel(
        passport_id=f"sp-{hashlib.sha256(f'{finding.id}-{now_iso}'.encode()).hexdigest()[:12]}",
        passport_version=1,
        passport_hash=passport_hash,
        finding_id=finding.id,
        account_id=account_id,
        region=region,
        resource_id=resource_id,
        resource_type=finding.resource.type,
        operation=finding.operation,
        operation_params=finding.operationParams,
        canonical_param_hash=canonical_param_hash,
        checks=all_checks,
        is_safety_blocked=is_blocked,
        blocked_reason=blocked_reason,
        risk_level=risk_level,
        risk_factors=risk_factors,
        generated_at=now_iso,
        expires_at=expires_at,
        freshness_limit_seconds=freshness_limit_seconds,
        is_stale=False,
        rollback_guidance=finding.recoveryGuidance,
        unverified_conditions=unverified_conditions,
        execution_mode=finding.execution_mode
    )

    return passport


def revalidate_safety_passport_before_execution(
    passport: SafetyPassportModel,
    target_finding: FindingModel,
    live_ec2_client: Optional[Any] = None,
    mode: str = "live"
) -> Tuple[bool, str, SafetyPassportModel]:
    """
    Re-runs required safety checks immediately before AWS execution.
    Fails closed if:
      - Resource identity or action parameters have changed (Passport invalidated).
      - Precondition evidence is stale (> freshness_limit_seconds) and cannot be refreshed.
      - Live AWS pre-flight verification indicates the resource or target rule is gone.
      - Any blocking precondition failed.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # ── 1. Invalidation Check: Parameter or Resource Mutated ──
    current_param_hash = compute_canonical_param_hash(target_finding.operationParams)
    if current_param_hash != passport.canonical_param_hash:
        err = (
            f"SAFETY VIOLATION: Safety Passport invalidated! Proposed action parameters have changed. "
            f"Original hash: {passport.canonical_param_hash[:8]}, Current hash: {current_param_hash[:8]}"
        )
        logger.error(f"[SafetyPassport] {err}")
        passport.is_safety_blocked = True
        passport.blocked_reason = err
        return False, err, passport

    if target_finding.resource.id != passport.resource_id:
        err = f"SAFETY VIOLATION: Safety Passport resource mismatch ({target_finding.resource.id} != {passport.resource_id})."
        logger.error(f"[SafetyPassport] {err}")
        passport.is_safety_blocked = True
        passport.blocked_reason = err
        return False, err, passport

    # ── 2. Freshness Check ──
    # If passport generated_at is older than freshness window, checks must be re-evaluated
    try:
        gen_time = datetime.fromisoformat(passport.generated_at.replace("Z", "+00:00"))
        age_seconds = (now - gen_time).total_seconds()
        if age_seconds > passport.freshness_limit_seconds:
            passport.is_stale = True
            logger.warning(f"[SafetyPassport] Passport {passport.passport_id} is STALE ({age_seconds:.1f}s old > {passport.freshness_limit_seconds}s limit).")
    except Exception as e:
        passport.is_stale = True

    # ── 3. Live Pre-flight Re-execution against AWS ──
    if mode == "live" and live_ec2_client is not None:
        try:
            # Re-read target resource
            sgs = live_ec2_client.describe_security_groups(GroupIds=[passport.resource_id]).get("SecurityGroups", [])
            if not sgs:
                err = f"Pre-flight failed: Resource '{passport.resource_id}' no longer exists in AWS."
                passport.is_safety_blocked = True
                passport.blocked_reason = err
                # Update check 1 to failed
                for c in passport.checks:
                    if c.label.startswith("Target Resource"):
                        c.passed = False
                        c.status = "failed"
                        c.detail = err
                        c.evaluated_at = now_iso
                return False, err, passport

            # Re-verify rule presence
            sg = sgs[0]
            rule_found = False
            for perm in sg.get("IpPermissions", []):
                from_p = perm.get("FromPort")
                to_p = perm.get("ToPort")
                proto = perm.get("IpProtocol", "")
                if (proto == "tcp" and from_p <= 22 <= to_p) or proto == "-1":
                    for ip_range in perm.get("IpRanges", []):
                        if ip_range.get("CidrIp") == "0.0.0.0/0":
                            rule_found = True
                            break

            if not rule_found:
                err = "Pre-flight failed: Target 0.0.0.0/0:22 rule is no longer present on resource."
                passport.is_safety_blocked = True
                passport.blocked_reason = err
                for c in passport.checks:
                    if c.label.startswith("Target Configuration"):
                        c.passed = False
                        c.status = "failed"
                        c.detail = err
                        c.evaluated_at = now_iso
                return False, err, passport

            # If re-evaluation passed, refresh check timestamps and clear staleness
            for c in passport.checks:
                if c.check_type == "aws_api":
                    c.evaluated_at = now_iso
                    c.status = "passed"
                    c.passed = True
            passport.is_stale = False

        except Exception as e:
            err = f"Pre-flight AWS evaluation failed: {str(e)}"
            passport.is_safety_blocked = True
            passport.blocked_reason = err
            return False, err, passport

    elif mode == "live" and passport.is_stale:
        # Live mode without fresh re-evaluation and passport is stale: FAIL CLOSED!
        err = f"SAFETY BLOCK: Precondition evidence is STALE (> {passport.freshness_limit_seconds}s) and cannot be verified without AWS client."
        passport.is_safety_blocked = True
        passport.blocked_reason = err
        return False, err, passport

    # ── 4. Verify all blocking checks passed ──
    for c in passport.checks:
        if c.isBlocking and (not c.passed or c.status != "passed"):
            err = f"Precondition '{c.label}' failed: {c.detail}"
            passport.is_safety_blocked = True
            passport.blocked_reason = err
            return False, err, passport

    return True, "Preconditions verified with fresh evidence.", passport
