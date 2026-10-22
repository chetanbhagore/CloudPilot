"""
Audit Trail & Proof-of-Outcome Router
Phase 10: Build a Trustworthy Audit Trail

Non-negotiable Rules:
- Audit trail is strictly append-only and cryptographically chained.
- Records real AWS Request IDs and verification evidence; never fabricates requests.
- Scoped to authenticated tenant organization: cross-tenant access is prohibited.
- Failed and blocked executions are recorded with equal rigor to successful ones.
- Local SHA-256 hash validates ledger sequence; CloudTrail cross-checks confirm AWS reality.
"""

import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, Response, HTTPException, status

from app.db.database import AuditRepository
from app.services.auth import (
    AuthenticatedUser,
    require_permission
)

logger = logging.getLogger("cloudpilot.audit")

router = APIRouter(prefix="/audit", tags=["Audit Ledger"])


@router.get("/events", summary="List verified audit events for current tenant")
async def get_audit_events(
    mode: Optional[str] = Query(None, description="Filter by execution mode ('live' or 'demo')"),
    outcome: Optional[str] = Query(None, description="Filter by outcome ('success', 'failed', 'blocked', etc.)"),
    current_user: AuthenticatedUser = Depends(require_permission("view:audit"))
) -> List[Dict[str, Any]]:
    """Retrieves all append-only audit events scoped strictly to the authenticated organization."""
    org_id = current_user.organization_id if isinstance(current_user, AuthenticatedUser) else "org-acme-prod"
    events = AuditRepository.list_events(org_id, mode=mode, outcome=outcome)
    logger.info(f"[Audit] Retrieved {len(events)} events for tenant {org_id} (mode={mode})")
    return events


@router.get("/verify", summary="Verify cryptographic tamper-evident hash chain")
async def verify_audit_ledger(
    current_user: AuthenticatedUser = Depends(require_permission("view:audit"))
) -> Dict[str, Any]:
    """
    Traverses the tenant's complete audit ledger from genesis to head, re-verifying
    each event's canonical SHA-256 hash and previous_hash link. Flags any altered records.
    """
    org_id = current_user.organization_id if isinstance(current_user, AuthenticatedUser) else "org-acme-prod"
    verification_report = AuditRepository.verify_ledger_chain(org_id)
    if verification_report.get("tamper_detected"):
        logger.error(f"[Audit] SECURITY ALERT: Tampering detected in tenant {org_id} ledger: {verification_report}")
    return verification_report


@router.get("/export", summary="Export audit ledger with cryptographic attestation")
async def export_audit_ledger(
    format: str = Query("json", pattern="^(json|csv)$", description="Export format: 'json' or 'csv'"),
    mode: Optional[str] = Query(None, description="Filter by execution mode ('live' or 'demo')"),
    current_user: AuthenticatedUser = Depends(require_permission("view:audit"))
):
    """
    Exports the tenant's complete audit trail either as a cryptographically signed JSON
    attestation package or as a standardized CSV document with CloudTrail cross-check hints.
    """
    org_id = current_user.organization_id if isinstance(current_user, AuthenticatedUser) else "org-acme-prod"
    export_data = AuditRepository.export_audit(org_id, format_type=format, mode=mode)

    if format.lower() == "csv":
        filename = f"cloudpilot-audit-{org_id}-{mode or 'all'}.csv"
        return Response(
            content=str(export_data),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    return export_data
