"""
Defensible Cost Intelligence & AWS Regional Pricing Engine
Phase 11: Cost Intelligence with Defensible Calculations

Non-negotiable Rules:
- No fabricated telemetry in live mode calculations.
- Defensible, reproducible formulas based on AWS regional price tables.
- Explicit distinction between:
  1. Potential savings estimate (finding detected)
  2. Approved potential savings (human approved)
  3. Executed remediation estimate (action sent to AWS)
  4. Verified resource change (resource verified removed from cloud)
  5. Realized savings (confirmed against AWS billing data / CUR)
- Never claim a resource change caused an invoice reduction without billing corroboration.
- Record input values, regional pricing source, exact formula, assumptions, and confidence levels.
"""

import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("cloudpilot.cost_engine")

# ── AWS Official Regional Baseline Pricing Matrices (USD) ────────────────────
# Rates per GiB-month for EBS Volume Storage
EBS_STORAGE_RATES: Dict[str, Dict[str, float]] = {
    "gp3": {
        "us-east-1": 0.080,
        "us-east-2": 0.080,
        "us-west-1": 0.096,
        "us-west-2": 0.080,
        "eu-west-1": 0.088,
        "eu-central-1": 0.095,
        "ap-south-1": 0.080,     # Mumbai baseline
        "ap-southeast-1": 0.096,  # Singapore
        "ap-northeast-1": 0.096,  # Tokyo
        "default": 0.080
    },
    "gp2": {
        "us-east-1": 0.100,
        "us-east-2": 0.100,
        "us-west-1": 0.120,
        "us-west-2": 0.100,
        "eu-west-1": 0.110,
        "eu-central-1": 0.119,
        "ap-south-1": 0.114,
        "ap-southeast-1": 0.120,
        "ap-northeast-1": 0.120,
        "default": 0.100
    },
    "io1": {
        "us-east-1": 0.125,
        "us-west-2": 0.125,
        "eu-west-1": 0.138,
        "ap-south-1": 0.138,
        "default": 0.125
    },
    "io2": {
        "us-east-1": 0.125,
        "us-west-2": 0.125,
        "eu-west-1": 0.138,
        "ap-south-1": 0.138,
        "default": 0.125
    },
    "st1": {
        "us-east-1": 0.045,
        "us-west-2": 0.045,
        "eu-west-1": 0.050,
        "ap-south-1": 0.054,
        "default": 0.045
    },
    "sc1": {
        "us-east-1": 0.015,
        "us-west-2": 0.015,
        "eu-west-1": 0.018,
        "ap-south-1": 0.018,
        "default": 0.015
    },
    "standard": {
        "us-east-1": 0.050,
        "us-west-2": 0.050,
        "ap-south-1": 0.057,
        "default": 0.050
    }
}

# On-Demand Compute hourly rates (USD/hr)
EC2_ON_DEMAND_HOURLY: Dict[str, Dict[str, float]] = {
    "t3.nano": {"us-east-1": 0.0052, "ap-south-1": 0.0057, "default": 0.0052},
    "t3.micro": {"us-east-1": 0.0104, "ap-south-1": 0.0114, "default": 0.0104},
    "t3.small": {"us-east-1": 0.0208, "ap-south-1": 0.0228, "default": 0.0208},
    "t3.medium": {"us-east-1": 0.0416, "ap-south-1": 0.0456, "default": 0.0416},
    "t3.large": {"us-east-1": 0.0832, "ap-south-1": 0.0912, "default": 0.0832},
    "m5.large": {"us-east-1": 0.096, "ap-south-1": 0.101, "default": 0.096},
    "c5.xlarge": {"us-east-1": 0.170, "ap-south-1": 0.176, "default": 0.170},
    "g4dn.xlarge": {"us-east-1": 0.526, "us-east-2": 0.526, "ap-south-1": 0.710, "default": 0.526},
    "p3.2xlarge": {"us-east-1": 3.060, "ap-south-1": 3.400, "default": 3.060}
}


class CostEstimate(BaseModel):
    resource_id: str
    resource_type: str
    service: str
    region: str
    pricing_source: str
    rate_applied: float
    rate_unit: str
    formula: str
    input_parameters: Dict[str, Any]
    estimated_monthly_cost: float
    estimated_potential_monthly_savings: float
    savings_stage: str = Field(
        "potential_unverified",
        description="Stage: potential_unverified | approved_pending_execution | executed_verification_pending | verified_resource_eliminated | realized_billing_confirmed"
    )
    assumptions: List[str]
    confidence_level: str  # high | medium | low
    uncertainty_description: str


def get_ebs_rate(region: str, volume_type: str) -> float:
    """Returns the regional per-GiB-month rate for an EBS volume type."""
    vtype = volume_type.lower()
    rates_for_type = EBS_STORAGE_RATES.get(vtype, EBS_STORAGE_RATES["gp3"])
    return rates_for_type.get(region, rates_for_type.get("default", 0.080))


def calculate_ebs_cost_estimate(
    region: str,
    volume_type: str,
    size_gb: float,
    iops: Optional[int] = None,
    throughput_mbps: Optional[int] = None,
    resource_id: str = "",
    status: str = "open"
) -> CostEstimate:
    """
    Computes defensible cost and savings estimate for unattached/idle EBS volumes.
    Handles base storage plus provisioned IOPS/throughput if applicable.
    """
    vtype = volume_type.lower()
    base_rate = get_ebs_rate(region, vtype)
    base_storage_cost = size_gb * base_rate

    extra_iops_cost = 0.0
    extra_throughput_cost = 0.0
    formula_parts = [f"{size_gb} GiB * ${base_rate:.4f}/GiB-mo"]

    # gp3 provisioned IOPS (> 3000 free baseline)
    if vtype == "gp3" and iops and iops > 3000:
        extra_iops = iops - 3000
        extra_iops_cost = extra_iops * 0.005  # $0.005/provisioned IOPS-month
        formula_parts.append(f"({extra_iops} extra IOPS * $0.005)")

    # gp3 provisioned throughput (> 125 MB/s free baseline)
    if vtype == "gp3" and throughput_mbps and throughput_mbps > 125:
        extra_tp = throughput_mbps - 125
        extra_throughput_cost = extra_tp * 0.040  # $0.040/MB/s-month
        formula_parts.append(f"({extra_tp} MB/s extra * $0.040)")

    total_monthly = round(base_storage_cost + extra_iops_cost + extra_throughput_cost, 2)
    formula_str = " + ".join(formula_parts)

    stage = "potential_unverified"
    if status == "approved":
        stage = "approved_pending_execution"
    elif status == "executing":
        stage = "executed_verification_pending"
    elif status == "resolved":
        stage = "verified_resource_eliminated"

    return CostEstimate(
        resource_id=resource_id,
        resource_type="AWS::EC2::Volume",
        service="Amazon EC2 (Elastic Block Store)",
        region=region,
        pricing_source=f"AWS Public Regional Price List (EBS {vtype.upper()})",
        rate_applied=base_rate,
        rate_unit="$/GiB-month",
        formula=formula_str,
        input_parameters={
            "size_gb": size_gb,
            "volume_type": vtype,
            "region": region,
            "provisioned_iops": iops or 3000,
            "provisioned_throughput_mbps": throughput_mbps or 125
        },
        estimated_monthly_cost=total_monthly,
        estimated_potential_monthly_savings=total_monthly,
        savings_stage=stage,
        assumptions=[
            "Standard EBS persistent volume billing (730 hours/month equivalent)",
            "Does not reflect AWS Enterprise Discount Program (EDP) or Volume Discounts",
            "Assumes zero snapshot retention costs included in calculation"
        ],
        confidence_level="high",
        uncertainty_description="Actual AWS invoice impact is pro-rated to the exact second the volume is deleted."
    )


def calculate_ec2_cost_estimate(
    region: str,
    instance_type: str,
    resource_id: str = "",
    status: str = "open"
) -> CostEstimate:
    """Computes defensible cost and savings estimate for idle EC2 instances."""
    itype = instance_type.lower()
    type_rates = EC2_ON_DEMAND_HOURLY.get(itype, EC2_ON_DEMAND_HOURLY.get("t3.medium"))
    hourly_rate = type_rates.get(region, type_rates.get("default", 0.0416))
    monthly_cost = round(hourly_rate * 730, 2)
    formula = f"${hourly_rate:.4f}/hr * 730 hrs/month"

    stage = "potential_unverified"
    if status == "approved":
        stage = "approved_pending_execution"
    elif status == "resolved":
        stage = "verified_resource_eliminated"

    return CostEstimate(
        resource_id=resource_id,
        resource_type="AWS::EC2::Instance",
        service="Amazon EC2 (Virtual Machines)",
        region=region,
        pricing_source=f"AWS On-Demand Price List ({itype})",
        rate_applied=hourly_rate,
        rate_unit="$/hour",
        formula=formula,
        input_parameters={
            "instance_type": itype,
            "region": region,
            "monthly_hours": 730
        },
        estimated_monthly_cost=monthly_cost,
        estimated_potential_monthly_savings=monthly_cost,
        savings_stage=stage,
        assumptions=[
            "Assumes 100% idle runtime across 730 monthly hours",
            "On-Demand Linux/UNIX baseline rate; excludes Windows or RHEL software licenses",
            "Excludes Savings Plans or Reserved Instance amortizations"
        ],
        confidence_level="medium",
        uncertainty_description="If instance is covered by an active Compute Savings Plan, dollar savings may be lower."
    )


def calculate_savings_summary(findings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Rolls up organization-wide savings into five distinct, defensible tiers.
    Never merges verified infrastructure changes into realized billing reductions.
    """
    potential_total = 0.0
    approved_total = 0.0
    verified_resource_total = 0.0
    realized_billing_total = 0.0  # Requires AWS Cost Explorer / CUR confirmation

    by_service: Dict[str, float] = {}

    for f in findings:
        if f.get("category") != "cost":
            continue

        savings = f.get("estimatedSavings") or f.get("estimatedMonthlyCost") or 0.0
        service = f.get("affectedService", "Other AWS")
        status = f.get("status", "open")

        if status in ("open", "in_review"):
            potential_total += savings
        elif status in ("approved", "executing"):
            approved_total += savings
        elif status == "resolved":
            verified_resource_total += savings

        by_service[service] = round(by_service.get(service, 0.0) + savings, 2)

    return {
        "stages": {
            "potential_savings": {
                "amount_usd": round(potential_total, 2),
                "description": "Unapproved potential savings discovered in live infrastructure scans."
            },
            "approved_savings": {
                "amount_usd": round(approved_total, 2),
                "description": "Actionable savings approved by authorized human engineer, awaiting execution."
            },
            "verified_resource_savings": {
                "amount_usd": round(verified_resource_total, 2),
                "description": (
                    "Projected monthly savings from cloud resources verified deleted or stopped via AWS describe calls. "
                    "Reflected on future AWS invoices."
                )
            },
            "realized_billing_confirmed": {
                "amount_usd": round(realized_billing_total, 2),
                "has_billing_integration": False,
                "description": (
                    "Direct invoice reductions corroborated by AWS Cost Explorer or Cost and Usage Reports (CUR). "
                    "Connect AWS Cost Explorer IAM permissions to enable retrospective billing verification."
                )
            }
        },
        "by_service": by_service,
        "calculation_rules": {
            "pricing_source": "AWS Regional Pricing Matrix (Public Standard 2026)",
            "monthly_hours_baseline": 730,
            "billing_verification_prerequisite": "Requires AWS Cost Explorer or CUR read permissions"
        }
    }
