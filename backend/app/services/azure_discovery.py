"""
Azure Security & FinOps Discovery Engine
Phase 1: Real ARM REST Discovery across Azure Subscriptions
Discovers:
  - AZ-SEC-NSG-001: Inbound Port 22 (SSH) open to Internet/any in Network Security Groups
  - AZ-SEC-NSG-002: Inbound Port 3389 (RDP) open to Internet/any in Network Security Groups
  - AZ-COST-DISK-001: Unattached Azure Managed Disks incurring idle storage charges
  - AZ-COST-PIP-001: Unassociated Azure Public IP addresses incurring idle IPv4 tariffs
  - AZ-SEC-STORAGE-001: Azure Storage Accounts with anonymous public blob access enabled
FAILS CLOSED: Never manufactures synthetic findings on live execution paths.
"""

import json
import logging
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional

from app.schemas import FindingModel, ResourceModel, SafetyCheck, TelemetryPoint
from app.services.safety_passport import build_safety_passport

logger = logging.getLogger("cloudpilot.azure_discovery")


def _execute_arm_get(url: str, token: str) -> Dict[str, Any]:
    """Helper to execute an authenticated GET request against Azure Resource Manager."""
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="GET"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def calculate_azure_disk_cost(disk_size_gb: int, tier: str) -> float:
    """Estimates monthly idle waste for unattached Azure Managed Disks."""
    tier_lower = (tier or "standard").lower()
    if "premium" in tier_lower:
        rate = 0.135
    elif "standardssd" in tier_lower:
        rate = 0.075
    else:
        rate = 0.040
    return round(disk_size_gb * rate, 2)


def scan_azure_subscription_live(
    subscription_id: str,
    access_token: str,
    scan_id: Optional[str] = None
) -> Tuple[List[FindingModel], int, List[str], List[str], Dict[str, str]]:
    """
    Executes real Azure Resource Manager discovery across live customer subscription.
    Returns:
        (findings, total_resources_scanned, successful_services, failed_services, errors_by_service)
    """
    sub_clean = subscription_id.strip().strip("{}")
    current_scan_id = scan_id or f"scan-az-{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    findings: List[FindingModel] = []
    total_resources = 0
    successful_services: List[str] = []
    failed_services: List[str] = []
    errors: Dict[str, str] = {}

    logger.info(f"[Azure Live Discovery] [scan_id={current_scan_id}] Scanning Azure subscription {sub_clean}")

    # ── 1. Network Security Groups: SSH (22) and RDP (3389) Ingress ──────────
    try:
        nsg_url = f"https://management.azure.com/subscriptions/{sub_clean}/providers/Microsoft.Network/networkSecurityGroups?api-version=2023-09-01"
        nsg_resp = _execute_arm_get(nsg_url, access_token)
        nsgs = nsg_resp.get("value", [])
        total_resources += len(nsgs)
        successful_services.append("Microsoft.Network/networkSecurityGroups")

        for nsg in nsgs:
            nsg_id = nsg.get("id", "")
            nsg_name = nsg.get("name", "nsg")
            location = nsg.get("location", "global")
            props = nsg.get("properties", {})
            rules = props.get("securityRules", [])

            for rule in rules:
                rule_props = rule.get("properties", {})
                access = (rule_props.get("access") or "").lower()
                direction = (rule_props.get("direction") or "").lower()
                protocol = (rule_props.get("protocol") or "").lower()
                src_prefix = rule_props.get("sourceAddressPrefix") or ""
                src_prefixes = rule_props.get("sourceAddressPrefixes") or []
                if src_prefix:
                    src_prefixes.append(src_prefix)

                is_inbound_allow = (access == "allow" and direction == "inbound")
                is_open_to_world = any(p in ["*", "0.0.0.0/0", "Internet", "any"] for p in src_prefixes)

                if not (is_inbound_allow and is_open_to_world):
                    continue

                dest_port = str(rule_props.get("destinationPortRange") or "")
                dest_ports = [str(p) for p in (rule_props.get("destinationPortRanges") or [])]
                if dest_port:
                    dest_ports.append(dest_port)

                # Check Port 22 SSH (AZ-SEC-NSG-001)
                is_ssh = any(p in ["22", "*"] for p in dest_ports)
                if is_ssh:
                    rule_name = rule.get("name", "SSH")
                    f_ssh = FindingModel(
                        id=f"live-az-nsg-ssh-{rule.get('id', uuid.uuid4().hex[:8]).split('/')[-1]}",
                        category="security",
                        severity="critical",
                        title=f"Inbound SSH (port 22) open to Internet in NSG '{nsg_name}'",
                        description=(
                            f"Network Security Group '{nsg_name}' in Azure subscription {sub_clean} ({location}) contains inbound rule '{rule_name}' "
                            f"allowing direct TCP port 22 traffic from {', '.join(src_prefixes)}. Anyone on the public internet can attempt authentication."
                        ),
                        rule="AZ-SEC-NSG-001: Inbound SSH (22) must not allow public internet access (* or Internet)",
                        resource=ResourceModel(
                            id=nsg_id,
                            type="Microsoft.Network/networkSecurityGroups",
                            name=nsg_name,
                            region=location,
                            age="Active NSG",
                            account_id=sub_clean,
                            tags=nsg.get("tags") or {}
                        ),
                        evidence=[
                            "Source API: GET /providers/Microsoft.Network/networkSecurityGroups",
                            f"Security Rule: {rule_name} • Priority: {rule_props.get('priority')}",
                            f"Source: {', '.join(src_prefixes)} ➔ Destination Port: 22 (TCP)",
                            f"Target NSG: {nsg_name} ({location})"
                        ],
                        status="open",
                        detectedAt=now_iso,
                        affectedService="Azure Virtual Network (Network Security Groups)",
                        recommendedAction=f"Remove or restrict open rule '{rule_name}' and enforce Azure Bastion or JIT VM access.",
                        operation="azure:network/networkSecurityGroups/securityRules/delete",
                        operationParams={
                            "nsg_id": nsg_id,
                            "rule_name": rule_name,
                            "resource_group": nsg_id.split("/resourceGroups/")[1].split("/")[0] if "/resourceGroups/" in nsg_id else ""
                        },
                        preconditions=[
                            SafetyCheck(
                                label="NSG Exists",
                                passed=True,
                                detail=f"Confirmed NSG '{nsg_name}' in {location}",
                                evidence_source="Microsoft.Network/networkSecurityGroups",
                                evaluated_at=now_iso
                            ),
                            SafetyCheck(
                                label="Rule Pattern Exact Match",
                                passed=True,
                                detail=f"Confirmed rule '{rule_name}' permits 0.0.0.0/0 or Internet on port 22",
                                evidence_source="Microsoft.Network/networkSecurityGroups",
                                evaluated_at=now_iso
                            )
                        ],
                        sideEffects=["Direct public SSH connections over the internet to attached NICs/subnets will be rejected."],
                        verificationPlan=[f"Call Azure ARM API for NSG '{nsg_name}' and confirm rule '{rule_name}' is absent."],
                        recoveryGuidance=[f"az network nsg rule create --resource-group <rg> --nsg-name {nsg_name} --name {rule_name} --priority {rule_props.get('priority', 1000)} --access Allow --direction Inbound --protocol Tcp --destination-port-ranges 22"],
                        recoveryLimitations="Re-creating rule will expose port 22 to the public internet.",
                        beforeState=f"NSG {nsg_name}: RULE '{rule_name}' PERMITS INTERNET:22 (CRITICAL EXPOSURE)",
                        afterState=f"NSG {nsg_name}: RULE '{rule_name}' REVOKED (VERIFIED ✓)",
                        execution_mode="live",
                        data_source="live_azure",
                        is_stale=False,
                        verified_at=now_iso,
                        account_id=sub_clean,
                        scan_id=current_scan_id
                    )
                    f_ssh.passport = build_safety_passport(f_ssh)
                    f_ssh.preconditions = f_ssh.passport.checks
                    f_ssh.isSafetyBlocked = f_ssh.passport.is_safety_blocked
                    f_ssh.blockedReason = f_ssh.passport.blocked_reason
                    findings.append(f_ssh)

                # Check Port 3389 RDP (AZ-SEC-NSG-002)
                is_rdp = any(p in ["3389", "*"] for p in dest_ports)
                if is_rdp and not is_ssh:
                    rule_name = rule.get("name", "RDP")
                    f_rdp = FindingModel(
                        id=f"live-az-nsg-rdp-{rule.get('id', uuid.uuid4().hex[:8]).split('/')[-1]}",
                        category="security",
                        severity="critical",
                        title=f"Inbound RDP (port 3389) open to Internet in NSG '{nsg_name}'",
                        description=(
                            f"Network Security Group '{nsg_name}' in Azure subscription {sub_clean} allows inbound TCP traffic on port 3389 from {', '.join(src_prefixes)}. "
                            f"Exposing Windows Remote Desktop directly to the internet exposes systems to BlueKeep and automated brute-force attacks."
                        ),
                        rule="AZ-SEC-NSG-002: Inbound RDP (3389) must not allow public internet access (* or Internet)",
                        resource=ResourceModel(
                            id=nsg_id,
                            type="Microsoft.Network/networkSecurityGroups",
                            name=nsg_name,
                            region=location,
                            age="Active NSG",
                            account_id=sub_clean,
                            tags=nsg.get("tags") or {}
                        ),
                        evidence=[
                            "Source API: GET /providers/Microsoft.Network/networkSecurityGroups",
                            f"Security Rule: {rule_name} • Priority: {rule_props.get('priority')}",
                            f"Source: {', '.join(src_prefixes)} ➔ Destination Port: 3389 (RDP)",
                            f"Target NSG: {nsg_name} ({location})"
                        ],
                        status="open",
                        detectedAt=now_iso,
                        affectedService="Azure Virtual Network (Network Security Groups)",
                        recommendedAction=f"Revoke rule '{rule_name}' and route management through Azure Bastion.",
                        operation="azure:network/networkSecurityGroups/securityRules/delete",
                        operationParams={
                            "nsg_id": nsg_id,
                            "rule_name": rule_name,
                            "resource_group": nsg_id.split("/resourceGroups/")[1].split("/")[0] if "/resourceGroups/" in nsg_id else ""
                        },
                        preconditions=[
                            SafetyCheck(
                                label="NSG Exists",
                                passed=True,
                                detail=f"Confirmed NSG '{nsg_name}' in {location}",
                                evidence_source="Microsoft.Network/networkSecurityGroups",
                                evaluated_at=now_iso
                            )
                        ],
                        sideEffects=["Direct internet RDP sessions will be disconnected."],
                        verificationPlan=[f"Call Azure ARM API for NSG '{nsg_name}' and assert rule '{rule_name}' is absent."],
                        recoveryGuidance=[f"az network nsg rule create --resource-group <rg> --nsg-name {nsg_name} --name {rule_name} --priority {rule_props.get('priority', 1000)} --access Allow --direction Inbound --protocol Tcp --destination-port-ranges 3389"],
                        recoveryLimitations="Rollback exposes port 3389 to internet attacks.",
                        beforeState=f"NSG {nsg_name}: RDP:3389 PERMITTED (CRITICAL EXPOSURE)",
                        afterState=f"NSG {nsg_name}: RDP:3389 REVOKED (VERIFIED ✓)",
                        execution_mode="live",
                        data_source="live_azure",
                        is_stale=False,
                        verified_at=now_iso,
                        account_id=sub_clean,
                        scan_id=current_scan_id
                    )
                    f_rdp.passport = build_safety_passport(f_rdp)
                    f_rdp.preconditions = f_rdp.passport.checks
                    f_rdp.isSafetyBlocked = f_rdp.passport.is_safety_blocked
                    f_rdp.blockedReason = f_rdp.passport.blocked_reason
                    findings.append(f_rdp)

    except Exception as e:
        logger.warning(f"[Azure Live Discovery] Error scanning NSGs in subscription {sub_clean}: {e}")
        failed_services.append("Microsoft.Network/networkSecurityGroups")
        errors["NSG"] = str(e)

    # ── 2. Unattached Managed Disks (AZ-COST-DISK-001) ───────────────────────
    try:
        disks_url = f"https://management.azure.com/subscriptions/{sub_clean}/providers/Microsoft.Compute/disks?api-version=2023-04-02"
        disks_resp = _execute_arm_get(disks_url, access_token)
        disks = disks_resp.get("value", [])
        total_resources += len(disks)
        successful_services.append("Microsoft.Compute/disks")

        for disk in disks:
            disk_id = disk.get("id", "")
            disk_name = disk.get("name", "disk")
            location = disk.get("location", "global")
            props = disk.get("properties", {})
            managed_by = props.get("managedBy")
            disk_state = props.get("diskState", "Unattached")

            # In Azure, unattached disks have managedBy == None or diskState == "Unattached"
            if not managed_by and disk_state in ["Unattached", "Reserved"]:
                size_gb = int(props.get("diskSizeGB", 32))
                sku_info = disk.get("sku", {})
                tier = sku_info.get("name", "Standard_LRS")
                monthly_cost = calculate_azure_disk_cost(size_gb, tier)

                f_disk = FindingModel(
                    id=f"live-az-disk-{disk_name}",
                    category="cost",
                    severity="medium" if monthly_cost > 15 else "low",
                    title=f"Unattached Azure Managed Disk '{disk_name}' ({size_gb} GB)",
                    description=(
                        f"Azure Managed Disk '{disk_name}' ({size_gb} GB, {tier}) in subscription {sub_clean} ({location}) is not attached to any Virtual Machine. "
                        f"Azure continues to charge for provisioned disk capacity (~${monthly_cost:.2f}/month) even when detached."
                    ),
                    rule="AZ-COST-DISK-001: Unattached Azure Managed Disks must be snapshot-backed and removed",
                    resource=ResourceModel(
                        id=disk_id,
                        type="Microsoft.Compute/disks",
                        name=disk_name,
                        region=location,
                        age="Unattached in Subscription",
                        account_id=sub_clean,
                        tags=disk.get("tags") or {}
                    ),
                    evidence=[
                        "Source API: GET /providers/Microsoft.Compute/disks",
                        f"Disk Name: {disk_name} • Size: {size_gb} GB • SKU: {tier}",
                        f"Attachment State: {disk_state} (managedBy is null)",
                        f"Estimated Idle Spend: ~${monthly_cost:.2f}/month"
                    ],
                    estimatedMonthlyCost=monthly_cost,
                    estimatedSavings=monthly_cost,
                    status="open",
                    detectedAt=now_iso,
                    affectedService="Azure Virtual Machines (Managed Disks)",
                    recommendedAction=f"Create a recovery snapshot of '{disk_name}' and delete the idle unattached disk.",
                    operation="azure:compute/disks/createSnapshot",
                    operationParams={
                        "disk_id": disk_id,
                        "disk_name": disk_name,
                        "resource_group": disk_id.split("/resourceGroups/")[1].split("/")[0] if "/resourceGroups/" in disk_id else ""
                    },
                    preconditions=[
                        SafetyCheck(
                            label="Disk Exists",
                            passed=True,
                            detail=f"Confirmed disk '{disk_name}' in {location}",
                            evidence_source="Microsoft.Compute/disks",
                            evaluated_at=now_iso
                        ),
                        SafetyCheck(
                            label="Zero VM Attachments",
                            passed=True,
                            detail="Confirmed managedBy is null and diskState is Unattached",
                            evidence_source="Microsoft.Compute/disks",
                            evaluated_at=now_iso
                        )
                    ],
                    sideEffects=[f"A safety snapshot backup will be created in your Azure subscription before any removal."],
                    verificationPlan=[f"Call Azure ARM API for disk '{disk_name}' and confirm safety snapshot creation."],
                    recoveryGuidance=[f"az disk create --resource-group <rg> --name {disk_name}-restored --source <snapshot-id>"],
                    recoveryLimitations="Restoring requires re-creating the disk from the safety snapshot.",
                    beforeState=f"Disk {disk_name}: UNATTACHED (~${monthly_cost:.2f}/mo)",
                    afterState=f"Disk {disk_name}: SNAPSHOTTED & ELIGIBLE FOR REMOVAL (VERIFIED ✓)",
                    execution_mode="live",
                    data_source="live_azure",
                    is_stale=False,
                    verified_at=now_iso,
                    account_id=sub_clean,
                    scan_id=current_scan_id
                )
                f_disk.passport = build_safety_passport(f_disk)
                f_disk.preconditions = f_disk.passport.checks
                f_disk.isSafetyBlocked = f_disk.passport.is_safety_blocked
                f_disk.blockedReason = f_disk.passport.blocked_reason
                findings.append(f_disk)

    except Exception as e:
        logger.warning(f"[Azure Live Discovery] Error scanning Managed Disks in subscription {sub_clean}: {e}")
        failed_services.append("Microsoft.Compute/disks")
        errors["Disks"] = str(e)

    # ── 3. Unassociated Public IP Addresses (AZ-COST-PIP-001) ─────────────────
    try:
        pip_url = f"https://management.azure.com/subscriptions/{sub_clean}/providers/Microsoft.Network/publicIPAddresses?api-version=2023-09-01"
        pip_resp = _execute_arm_get(pip_url, access_token)
        pips = pip_resp.get("value", [])
        total_resources += len(pips)
        successful_services.append("Microsoft.Network/publicIPAddresses")

        for pip in pips:
            pip_id = pip.get("id", "")
            pip_name = pip.get("name", "pip")
            location = pip.get("location", "global")
            props = pip.get("properties", {})
            ip_addr = props.get("ipAddress", "Unassigned")
            ip_config = props.get("ipConfiguration")

            # Unassociated public IPs have ipConfiguration == null
            if not ip_config:
                f_pip = FindingModel(
                    id=f"live-az-pip-{pip_name}",
                    category="cost",
                    severity="low",
                    title=f"Unassociated Azure Public IP '{pip_name}' ({ip_addr})",
                    description=(
                        f"Azure Public IP address '{pip_name}' ({ip_addr}) in subscription {sub_clean} ({location}) is allocated but unassociated with any NIC, Load Balancer, or Gateway. "
                        f"Microsoft charges $0.005/hour (~$3.60/month) for idle allocated IPv4 addresses."
                    ),
                    rule="AZ-COST-PIP-001: Unassociated Azure Public IP addresses must be released to eliminate idle charges",
                    resource=ResourceModel(
                        id=pip_id,
                        type="Microsoft.Network/publicIPAddresses",
                        name=pip_name,
                        region=location,
                        age="Unassociated in Subscription",
                        account_id=sub_clean,
                        tags=pip.get("tags") or {}
                    ),
                    evidence=[
                        "Source API: GET /providers/Microsoft.Network/publicIPAddresses",
                        f"Public IP Name: {pip_name} • IP Address: {ip_addr}",
                        "Association State: None (ipConfiguration is null)",
                        "Calculated Run-Rate: ~$3.60/month ($0.005/hour Azure IPv4 Idle Tariff)"
                    ],
                    estimatedMonthlyCost=3.60,
                    estimatedSavings=3.60,
                    status="open",
                    detectedAt=now_iso,
                    affectedService="Azure Virtual Network (Public IP Addresses)",
                    recommendedAction=f"Delete unassociated Public IP '{pip_name}' to eliminate recurring idle charges.",
                    operation="azure:network/publicIPAddresses/delete",
                    operationParams={
                        "pip_id": pip_id,
                        "pip_name": pip_name,
                        "resource_group": pip_id.split("/resourceGroups/")[1].split("/")[0] if "/resourceGroups/" in pip_id else ""
                    },
                    preconditions=[
                        SafetyCheck(
                            label="Public IP Exists",
                            passed=True,
                            detail=f"Confirmed Public IP '{pip_name}' in {location}",
                            evidence_source="Microsoft.Network/publicIPAddresses",
                            evaluated_at=now_iso
                        ),
                        SafetyCheck(
                            label="Zero NIC Associations",
                            passed=True,
                            detail="Confirmed ipConfiguration is null",
                            evidence_source="Microsoft.Network/publicIPAddresses",
                            evaluated_at=now_iso
                        )
                    ],
                    sideEffects=[f"Public IP address {ip_addr} will be returned to Microsoft's pool and cannot be reserved."],
                    verificationPlan=[f"Call Azure ARM API for '{pip_name}' and confirm resource is absent."],
                    recoveryGuidance=["Released Azure Public IPs return to the public cloud pool. Re-allocation cannot be guaranteed."],
                    recoveryLimitations="Released Azure Public IPs return to the public cloud pool.",
                    beforeState=f"Public IP {pip_name} ({ip_addr}): UNASSOCIATED (~$3.60/mo)",
                    afterState=f"Public IP {pip_name}: DELETED ($0.00/mo ✓)",
                    execution_mode="live",
                    data_source="live_azure",
                    is_stale=False,
                    verified_at=now_iso,
                    account_id=sub_clean,
                    scan_id=current_scan_id
                )
                f_pip.passport = build_safety_passport(f_pip)
                f_pip.preconditions = f_pip.passport.checks
                f_pip.isSafetyBlocked = f_pip.passport.is_safety_blocked
                f_pip.blockedReason = f_pip.passport.blocked_reason
                findings.append(f_pip)

    except Exception as e:
        logger.warning(f"[Azure Live Discovery] Error scanning Public IPs in subscription {sub_clean}: {e}")
        failed_services.append("Microsoft.Network/publicIPAddresses")
        errors["PublicIPs"] = str(e)

    # ── 4. Azure Storage Accounts with Public Blob Access (AZ-SEC-STORAGE-001)
    try:
        storage_url = f"https://management.azure.com/subscriptions/{sub_clean}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01"
        storage_resp = _execute_arm_get(storage_url, access_token)
        storage_accounts = storage_resp.get("value", [])
        total_resources += len(storage_accounts)
        successful_services.append("Microsoft.Storage/storageAccounts")

        for sa in storage_accounts:
            sa_id = sa.get("id", "")
            sa_name = sa.get("name", "storage")
            location = sa.get("location", "global")
            props = sa.get("properties", {})
            allow_public = props.get("allowBlobPublicAccess", False)

            if allow_public:
                f_storage = FindingModel(
                    id=f"live-az-storage-{sa_name}",
                    category="security",
                    severity="critical",
                    title=f"Azure Storage Account '{sa_name}' allows Public Anonymous Blob Access",
                    description=(
                        f"Storage Account '{sa_name}' in Azure subscription {sub_clean} has 'allowBlobPublicAccess: true'. "
                        f"Containers in this storage account can be configured to permit unauthenticated read access from the public internet."
                    ),
                    rule="AZ-SEC-STORAGE-001: Azure Storage Accounts must disallow anonymous public blob access",
                    resource=ResourceModel(
                        id=sa_id,
                        type="Microsoft.Storage/storageAccounts",
                        name=sa_name,
                        region=location,
                        age="Active Storage Account",
                        account_id=sub_clean,
                        tags=sa.get("tags") or {}
                    ),
                    evidence=[
                        "Source API: GET /providers/Microsoft.Storage/storageAccounts",
                        f"Storage Account: {sa_name} ({location})",
                        "Setting: allowBlobPublicAccess is True",
                        "Risk: Potential anonymous public internet exfiltration of blob data"
                    ],
                    status="open",
                    detectedAt=now_iso,
                    affectedService="Azure Storage (Blob Storage)",
                    recommendedAction=f"Disable anonymous public blob access on Storage Account '{sa_name}'.",
                    operation="azure:storage/storageAccounts/patch",
                    operationParams={
                        "storage_id": sa_id,
                        "storage_name": sa_name,
                        "resource_group": sa_id.split("/resourceGroups/")[1].split("/")[0] if "/resourceGroups/" in sa_id else ""
                    },
                    preconditions=[
                        SafetyCheck(
                            label="Storage Account Exists",
                            passed=True,
                            detail=f"Confirmed storage account '{sa_name}' in {location}",
                            evidence_source="Microsoft.Storage/storageAccounts",
                            evaluated_at=now_iso
                        ),
                        SafetyCheck(
                            label="Public Blob Access Enabled",
                            passed=True,
                            detail="Confirmed allowBlobPublicAccess is True",
                            evidence_source="Microsoft.Storage/storageAccounts",
                            evaluated_at=now_iso
                        )
                    ],
                    sideEffects=["Anonymous public HTTP requests to blobs in this account will be blocked."],
                    verificationPlan=[f"Call Azure ARM API for storage account '{sa_name}' and assert allowBlobPublicAccess is False."],
                    recoveryGuidance=[f"az storage account update --name {sa_name} --resource-group <rg> --allow-blob-public-access true"],
                    recoveryLimitations="Re-enabling permits anonymous public access to containers.",
                    beforeState=f"Storage {sa_name}: PUBLIC BLOB ACCESS ALLOWED (CRITICAL EXPOSURE)",
                    afterState=f"Storage {sa_name}: PUBLIC BLOB ACCESS DISABLED (VERIFIED ✓)",
                    execution_mode="live",
                    data_source="live_azure",
                    is_stale=False,
                    verified_at=now_iso,
                    account_id=sub_clean,
                    scan_id=current_scan_id
                )
                f_storage.passport = build_safety_passport(f_storage)
                f_storage.preconditions = f_storage.passport.checks
                f_storage.isSafetyBlocked = f_storage.passport.is_safety_blocked
                f_storage.blockedReason = f_storage.passport.blocked_reason
                findings.append(f_storage)

    except Exception as e:
        logger.warning(f"[Azure Live Discovery] Error scanning Storage Accounts in subscription {sub_clean}: {e}")
        failed_services.append("Microsoft.Storage/storageAccounts")
        errors["Storage"] = str(e)

    logger.info(
        f"[Azure Live Discovery] Scan {current_scan_id} finished: {len(findings)} findings across "
        f"{total_resources} resources scanned. Successful services: {successful_services}, Failed: {failed_services}"
    )

    return findings, total_resources, successful_services, failed_services, errors
