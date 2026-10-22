"""
Cost Intelligence & Defensible Savings Router
Phase 11: Cost Intelligence with Defensible Calculations

Non-negotiable Rules:
- Transparent, reproducible formulas for all estimates.
- Distinct tiers for potential, approved, verified resource changes, and realized billing savings.
- Disclaimers on billing verification requirements (AWS Cost Explorer / CUR).
"""

import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.db.database import FindingRepository
from app.services.auth import AuthenticatedUser, require_permission
from app.services.cost_engine import (
    calculate_ebs_cost_estimate,
    calculate_ec2_cost_estimate,
    calculate_savings_summary,
    CostEstimate
)

logger = logging.getLogger("cloudpilot.cost_router")

router = APIRouter(prefix="/cost", tags=["Cost Intelligence"])


class EstimateResourceCostRequest(BaseModel):
    service: str  # "ebs" | "ec2"
    region: str = "ap-south-1"
    volume_type: Optional[str] = "gp3"
    size_gb: Optional[float] = 100.0
    iops: Optional[int] = None
    throughput_mbps: Optional[int] = None
    instance_type: Optional[str] = "t3.medium"
    resource_id: Optional[str] = ""


@router.get("/summary", summary="Get defensible savings rollup across stages")
async def get_cost_savings_summary(
    mode: Optional[str] = Query(None, description="Execution mode: 'live' or 'demo'"),
    current_user: AuthenticatedUser = Depends(require_permission("view:findings"))
) -> Dict[str, Any]:
    """
    Returns defensible organization-wide savings categorized across the 5 stages:
    potential unverified, approved, verified resource eliminated, and realized billing confirmed.
    """
    org_id = current_user.organization_id if isinstance(current_user, AuthenticatedUser) else "org-acme-prod"
    findings = FindingRepository.list_findings(org_id, mode=mode)
    summary = calculate_savings_summary(findings)
    summary["organization_id"] = org_id
    summary["execution_mode"] = mode or "all"
    summary["findings_analyzed"] = len(findings)
    return summary


@router.post("/estimate", summary="Compute defensible cost estimate for resource parameters")
async def estimate_resource_cost(
    request: EstimateResourceCostRequest,
    current_user: AuthenticatedUser = Depends(require_permission("view:findings"))
) -> CostEstimate:
    """Computes a reproducible, defensible cost and savings estimate based on AWS regional price tables."""
    svc = request.service.lower()
    if svc in ("ebs", "volume"):
        return calculate_ebs_cost_estimate(
            region=request.region,
            volume_type=request.volume_type or "gp3",
            size_gb=request.size_gb or 20.0,
            iops=request.iops,
            throughput_mbps=request.throughput_mbps,
            resource_id=request.resource_id or "adhoc-calc"
        )
    elif svc in ("ec2", "instance"):
        return calculate_ec2_cost_estimate(
            region=request.region,
            instance_type=request.instance_type or "t3.medium",
            resource_id=request.resource_id or "adhoc-calc"
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported service '{request.service}'. Supported: 'ebs', 'ec2'."
        )
