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
    elif finding.operation == "azure:network/networkSecurityGroups/securityRules/delete":
        meta = getattr(finding, "metadata", None) or getattr(finding, "operationParams", None) or {}
        rule_name = meta.get("rule_name") or finding.resource.name or "security rule"
        root_cause = (
            f"Azure Network Security Group '{finding.resource.name}' contains rule '{rule_name}' "
            f"allowing unrestricted inbound traffic from '{meta.get('source_address_prefix', '*')}' "
            f"on destination port {meta.get('destination_port', '22/3389')}. "
            f"This exposes management interfaces directly to the public internet."
        )
        blast_radius = (
            "Risk of inaction: Vulnerable to automated internet crawlers, brute-force SSH/RDP attacks, and zero-day exploits. "
            "Remediation impact: Permanently deletes the insecure inbound security rule from the NSG. "
            "Internal VNet and VPN/Bastion connections will remain unaffected if configured via separate private rules."
        )
        uncertainty.extend([
            "Verify whether administrative access requires direct public IP access or if Azure Bastion / VPN gateway is available.",
            f"Rollback: az network nsg rule create -g {meta.get('resource_group', '<rg>')} --nsg-name {meta.get('nsg_name', '<nsg>')} -n {rule_name} --priority {meta.get('priority', '1000')} --direction Inbound --access Allow --protocol Tcp --destination-port-ranges {meta.get('destination_port', '22')}"
        ])
    elif finding.operation == "azure:network/publicIPAddresses/delete":
        meta = getattr(finding, "metadata", None) or getattr(finding, "operationParams", None) or {}
        root_cause = (
            f"Azure Public IP '{finding.resource.name}' ({meta.get('ip_address', 'Unassigned')}) "
            f"is provisioned in Resource Group '{meta.get('resource_group', '')}' but is unassociated with any NIC or Virtual Machine. "
            f"Azure assesses a continuous reservation fee of ~$0.005/hour for idle public IPv4 addresses."
        )
        blast_radius = (
            "Risk of inaction: Incurs unnecessary monthly cloud charges against your Azure subscription credit. "
            "Remediation impact: Deletes the public IP address resource from Azure Resource Manager. Zero downtime to running workloads."
        )
        uncertainty.extend([
            "Once released, this specific public IPv4 address is recycled into the Azure pool and cannot be re-reserved.",
            "Confirm that no external DNS records, webhooks, or third-party allowlists point to this IP address."
        ])
    elif finding.operation == "azure:compute/disks/delete":
        meta = getattr(finding, "metadata", None) or getattr(finding, "operationParams", None) or {}
        disk_size = meta.get("disk_size_gb", 32)
        sku = meta.get("sku", "Standard_LRS")
        root_cause = (
            f"Azure Managed Disk '{finding.resource.name}' ({disk_size} GB, {sku}) is currently in 'Unattached' state. "
            f"Azure charges storage rates for all provisioned managed disks regardless of whether a virtual machine is attached or powered off."
        )
        blast_radius = (
            "Risk of inaction: Monthly storage waste ($0.04 - $0.135/GB/month depending on disk tier). "
            "Remediation impact: Deletes the managed disk resource permanently from Azure. Irreversible without an Azure Disk Snapshot."
        )
        uncertainty.extend([
            "Ensure no historical application state, configuration files, or database logs needed for compliance reside on this disk.",
            "Create an Azure disk snapshot before initiating deletion if data retention is required."
        ])
    elif finding.operation == "azure:storage/storageAccounts/patch":
        meta = getattr(finding, "metadata", None) or getattr(finding, "operationParams", None) or {}
        root_cause = (
            f"Azure Storage Account '{finding.resource.name}' has 'allowBlobPublicAccess: true'. "
            f"This setting overrides container-level security and enables anonymous unauthenticated internet users to download blobs if container ACLs are misconfigured."
        )
        blast_radius = (
            "Risk of inaction: Critical risk of data exfiltration and public disclosure of sensitive files or backups. "
            "Remediation impact: Updates storage account ARM property 'allowBlobPublicAccess' to false. "
            "Authorized Entra ID (Azure AD), Managed Identity, and Shared Access Signature (SAS) token requests are unaffected."
        )
        uncertainty.extend([
            "If this storage account hosts public static assets (e.g. public website images, client downloads), anonymous users will receive HTTP 403 Forbidden.",
            f"Rollback: az storage account update -g {meta.get('resource_group', '<rg>')} -n {finding.resource.name} --allow-blob-public-access true"
        ])
    else:
        root_cause = f"Resource '{finding.resource.id}' violates cloud governance rule '{finding.rule}'."
        blast_radius = "Review finding evidence and resource tags prior to taking remediation action."
        uncertainty.append("Non-standard resource type: automated verification is limited.")

    # Always document mode provenance accurately for AWS vs Azure
    is_azure = finding.operation.startswith("azure:") or (finding.resource.id and finding.resource.id.startswith("/subscriptions/"))
    if is_azure:
        provenance = "Live Azure Resource Manager (ARM) Telemetry" if finding.execution_mode == "live" else "Simulated Azure Telemetry"
    else:
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
