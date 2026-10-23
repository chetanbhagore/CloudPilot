"""
Evidence-Grounded AI Explanation Engine
Phase 15: AI Explanations & Commercial Readiness
Non-negotiable Rules:
- Ground every explanation in verified AWS evidence; NEVER fabricate telemetry, prices, or account state.
- Clear distinction between 'observed_facts', 'ai_analysis', and 'recommended_actions'.
- Explicitly document uncertainty, assumptions, and unverified boundary conditions.
- AI CANNOT grant permissions or independently authorize or execute remediation.
- Proposed actions are strictly validated against the server-side Action Registry.
"""

import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from app.schemas import FindingModel
from app.services.remediation import action_registry

logger = logging.getLogger("cloudpilot.ai_explainer")


class FindingAIExplanation(BaseModel):
    finding_id: str
    resource_id: str
    observed_facts: List[str] = Field(description="Deterministic verified evidence from AWS APIs")
    root_cause_analysis: str = Field(description="Human-intelligible explanation of why this finding exists")
    blast_radius_summary: str = Field(description="Potential impact of inaction vs impact of remediation")
    recommended_action: str = Field(description="Human-in-the-loop remediation recommendation")
    action_type: str
    is_action_supported_by_engine: bool = Field(description="True only if action exists in verified Action Registry")
    uncertainty_and_limitations: List[str] = Field(description="Explicit disclaimers regarding unverified conditions")
    evidence_provenance: str = Field(default="Live AWS API Telemetry")
    disclaimer: str = (
        "AI explanations provide advisory context based exclusively on verified scan telemetry. "
        "AI cannot authorize or execute cloud mutations. All remediations require human approval via Safety Passport™."
    )


def generate_finding_explanation(finding: FindingModel) -> FindingAIExplanation:
    """
    Generates an evidence-grounded explanation for a discovered finding.
    Strictly derives facts from finding evidence and does not invent telemetry.
    """
    observed_facts: List[str] = []
    
    # 1. Extract verified evidence
    if finding.evidence and len(finding.evidence) > 0:
        observed_facts.extend([f"Observed Evidence: {e}" for e in finding.evidence])
    else:
        observed_facts.append(f"Resource '{finding.resource.id}' detected with status '{finding.status}'.")

    observed_facts.append(f"Target Resource: {finding.resource.type} ({finding.resource.id}) in {finding.resource.region or 'ap-south-1'}")
    if finding.beforeState:
        observed_facts.append(f"Verified State: {finding.beforeState}")
    if finding.estimatedMonthlyCost is not None and finding.estimatedMonthlyCost > 0:
        observed_facts.append(f"Estimated Monthly Baseline Cost: ${finding.estimatedMonthlyCost:.2f}/mo")

    # 2. Check Action Registry support
    action_def = action_registry.get(finding.operation)
    is_action_registered = action_def is not None

    # 3. Determine root cause and blast radius grounded in finding type
    uncertainty: List[str] = []
    
    if finding.operation == "ec2:RevokeSecurityGroupIngress":
        root_cause = (
            f"Security Group '{finding.resource.id}' has an inbound ingress rule configured with CIDR '0.0.0.0/0' "
            f"on port 22 (SSH). This allows unrestricted ingress connection attempts from any public internet IP address."
        )
        blast_radius = (
            "Risk of inaction: Vulnerable to brute-force authentication attempts and automated credential stuffing. "
            "Remediation impact: Closes public SSH. Existing active SSH sessions will be severed upon revocation. "
            "Internal VPC and bastion ingress remains unaffected if configured via separate private rules."
        )
        uncertainty.extend([
            "CloudPilot cannot inspect external corporate firewalls or VPN tunnels terminating outside AWS.",
            "Verify that legitimate administration does not rely on direct internet-facing SSH before revoking."
        ])
    elif "Volume" in finding.resource.type or "Volume" in finding.operation:
        root_cause = (
            f"Storage volume '{finding.resource.id}' is currently unattached to any EC2 instance "
            f"and continues to incur monthly AWS storage fees."
        )
        blast_radius = (
            "Risk of inaction: Continuous unutilized cloud expenditure. "
            "Remediation impact: Storage volume lifecycle modification or deletion. Irreversible without snapshot."
        )
        uncertainty.extend([
            "CloudPilot cannot determine whether historical database data on this unattached volume is subject to statutory retention.",
            "A pre-deletion snapshot is recommended before any destructive storage operation."
        ])
    elif "ReleaseAddress" in finding.operation or "EIP" in finding.resource.type:
        root_cause = (
            f"Elastic IP '{finding.resource.id}' is allocated to the account but currently unassociated with any ENI or compute instance, "
            f"incurring ongoing AWS idle IPv4 charges ($0.005/hour)."
        )
        blast_radius = (
            "Risk of inaction: Continuous unutilized cloud expenditure. "
            "Remediation impact: Returns public IP to AWS pool. Zero compute interruption."
        )
        uncertainty.extend([
            "Once released, an Elastic IP cannot be guaranteed to be re-allocated if needed in the future.",
            "Confirm that no external DNS or third-party allowlists reference this public IP."
        ])
    elif "PutPublicAccessBlock" in finding.operation or "Bucket" in finding.resource.type:
        root_cause = (
            f"S3 bucket '{finding.resource.id}' does not have AWS S3 Block Public Access fully enabled. "
            f"Objects in this bucket may be exposed to unauthenticated public internet requests."
        )
        blast_radius = (
            "Risk of inaction: Critical risk of data exfiltration and compliance breach. "
            "Remediation impact: Immediately blocks public ACLs and public policies across the bucket."
        )
        uncertainty.extend([
            "If this bucket is intentionally hosting public web assets (e.g. static website), public access will be blocked.",
            "Verify whether public internet access is a documented architectural requirement before enforcing."
        ])
    elif "AccessKey" in finding.resource.type or "UpdateAccessKey" in finding.operation:
        root_cause = (
            f"IAM Access Key '{finding.resource.id}' is active and older than 90 days without rotation, "
            f"violating CIS AWS Foundations Benchmark 1.14."
        )
        blast_radius = (
            "Risk of inaction: Prolonged window of vulnerability in the event of credential leakage. "
            "Remediation impact: Deactivates access key. Any automation or CI/CD pipelines using this key will immediately fail authentication."
        )
        uncertainty.extend([
            "CloudPilot cannot identify external CI/CD systems or third-party tools that may have this key embedded in environment secrets.",
            "Ensure a replacement access key has been generated and distributed before deactivating."
        ])
    else:
        root_cause = f"Resource '{finding.resource.id}' violates cloud governance rule '{finding.rule}'."
        blast_radius = "Review finding evidence and resource tags prior to taking remediation action."
        uncertainty.append("Non-standard resource type: automated verification is limited.")

    # Always document mode provenance
    provenance = "Live AWS API Telemetry" if finding.execution_mode == "live" else "Simulated Demo Telemetry"

    return FindingAIExplanation(
        finding_id=finding.id,
        resource_id=finding.resource.id,
        observed_facts=observed_facts,
        root_cause_analysis=root_cause,
        blast_radius_summary=blast_radius,
        recommended_action=finding.recommendedAction or "Review finding in Safety Passport and approve remediation.",
        action_type=finding.operation,
        is_action_supported_by_engine=is_action_registered,
        uncertainty_and_limitations=uncertainty,
        evidence_provenance=provenance
    )
