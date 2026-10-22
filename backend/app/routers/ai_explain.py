"""
AI Finding Explanation Router
Phase 15: AI Explanations & Commercial Readiness
Non-negotiable Rules:
- Server-side authentication and 'view:findings' authorization required.
- Tenant isolation enforced: cannot explain findings belonging to other organizations.
- Advisory only: cannot trigger write operations or mutate state.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from app.services.auth import get_current_user, require_permission, enforce_tenant_isolation, AuthenticatedUser
from app.services.ai_explainer import generate_finding_explanation, FindingAIExplanation
from app.db.database import FindingRepository
from app.routers.discovery import _cached_findings

router = APIRouter(prefix="/findings", tags=["AI Explanation"])


@router.get("/{finding_id}/explain", response_model=FindingAIExplanation)
def get_finding_explanation(
    finding_id: str,
    mode: str = Query("live"),
    current_user: AuthenticatedUser = Depends(require_permission("view:findings"))
):
    """
    Returns an evidence-grounded AI explanation for a discovered finding.
    Strictly derives facts from verified AWS evidence and highlights uncertainty.
    """
    finding = None

    # 1. Search persistent SQLite database first
    db_findings = FindingRepository.list_findings(current_user.organization_id, mode=mode)
    for f in db_findings:
        if f.get("id") == finding_id:
            # Reconstruct FindingModel
            try:
                from app.schemas import FindingModel
                finding = FindingModel(**f)
                break
            except Exception:
                pass

    # 2. Check memory cache as secondary lookup
    if not finding and finding_id in _cached_findings:
        cached = _cached_findings[finding_id]
        if cached.organization_id == current_user.organization_id or current_user.is_demo:
            finding = cached

    # 3. If in explicit demo mode, check demo fixture
    if not finding and (mode == "demo" or current_user.is_demo):
        from app.services.aws_discovery import DEMO_FINDINGS
        demo_match = next((f for f in DEMO_FINDINGS if f.id == finding_id), None)
        if demo_match:
            finding = demo_match

    if not finding:
        raise HTTPException(
            status_code=404,
            detail=f"Finding '{finding_id}' not found in organization '{current_user.organization_id}'."
        )

    # 4. Enforce tenant isolation
    if finding.organization_id and not current_user.is_demo:
        enforce_tenant_isolation(finding.organization_id, current_user)

    return generate_finding_explanation(finding)
