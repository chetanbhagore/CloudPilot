"""
Phase 2 Tests: Azure Multi-Cloud Verified Remediation & AI Explainer
Validates:
- Real ARM 3-phase verified remediation (Pre-flight check -> ARM mutation -> Post-mutation verification)
- Deletion of insecure NSG security rule (SSH/RDP)
- Deletion of idle unassociated Public IP
- Safe guard preventing deletion of associated Public IP
- Safe guard preventing deletion of attached Managed Disk
- Deletion of unattached Managed Disk
- PATCH mutation disabling storage account public blob access
- Evidence-grounded AI Explanations and az CLI rollback commands for all Azure operations
"""

import unittest
from unittest.mock import MagicMock, patch
import os
import sys
import json
import io
import urllib.error

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas import FindingModel, ResourceModel
from app.services.azure_remediation import (
    execute_azure_live_remediation,
    AzureRemediationPreflightError,
    AzureRemediationVerificationError
)
from app.services.ai_explainer import generate_finding_explanation


class TestAzurePhase2(unittest.TestCase):

    def setUp(self):
        self.maxDiff = None

    # ── 1. Insecure NSG Rule Verified Deletion ──
    def test_remediate_nsg_rule_success(self):
        rule_sub_id = "/subscriptions/sub-123/resourceGroups/rg-test/providers/Microsoft.Network/networkSecurityGroups/nsg-1/securityRules/Allow-SSH"
        params = {
            "resource_group": "rg-test",
            "nsg_name": "nsg-1",
            "rule_name": "Allow-SSH"
        }

        # Step 1: Preflight GET -> returns rule object
        mock_preflight_resp = MagicMock()
        mock_preflight_resp.read.return_value = json.dumps({
            "name": "Allow-SSH",
            "properties": {"destinationPortRange": "22", "access": "Allow"}
        }).encode("utf-8")
        mock_preflight_resp.__enter__.return_value = mock_preflight_resp

        # Step 2: DELETE -> returns 200/204 with x-ms-request-id
        mock_delete_resp = MagicMock()
        mock_delete_resp.status = 204
        mock_delete_resp.read.return_value = b""
        mock_delete_resp.headers = {"x-ms-request-id": "req-arm-del-nsg-001"}
        mock_delete_resp.__enter__.return_value = mock_delete_resp

        # Step 3: Verification GET -> raises 404 (rule deleted!)
        err_404 = urllib.error.HTTPError(
            url="https://management.azure.com/...",
            code=404,
            msg="NotFound",
            hdrs={},
            fp=io.BytesIO(b'{"error":{"code":"ResourceNotFound"}}')
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.side_effect = [
                mock_preflight_resp,  # pre-flight GET
                mock_delete_resp,     # DELETE
                err_404               # verify GET returns 404
            ]

            record = execute_azure_live_remediation(
                subscription_id="sub-123",
                action_type="azure:network/networkSecurityGroups/securityRules/delete",
                resource_id=rule_sub_id,
                parameters=params,
                oauth_token="bearer-token-123"
            )

            self.assertEqual(record.state, "succeeded")
            self.assertEqual(record.verification_status, "verified")
            self.assertEqual(record.aws_request_id, "req-arm-del-nsg-001")
            self.assertIn("DELETED (VERIFIED ✓)", record.after_state)
            self.assertIsNotNone(record.verified_at)
            self.assertEqual(mock_urlopen.call_count, 3)

    # ── 2. Idle Public IP Verified Deletion ──
    def test_remediate_idle_public_ip_success(self):
        pip_id = "/subscriptions/sub-123/resourceGroups/rg-test/providers/Microsoft.Network/publicIPAddresses/pip-idle"
        params = {
            "resource_group": "rg-test",
            "public_ip_name": "pip-idle"
        }

        # Step 1: Pre-flight GET confirms ipConfiguration is None (unassociated)
        mock_preflight_resp = MagicMock()
        mock_preflight_resp.read.return_value = json.dumps({
            "name": "pip-idle",
            "properties": {"ipAddress": "20.10.15.20", "ipConfiguration": None}
        }).encode("utf-8")
        mock_preflight_resp.__enter__.return_value = mock_preflight_resp

        # Step 2: DELETE -> 200/204
        mock_delete_resp = MagicMock()
        mock_delete_resp.status = 200
        mock_delete_resp.read.return_value = b""
        mock_delete_resp.headers = {"x-ms-request-id": "req-arm-del-pip-002"}
        mock_delete_resp.__enter__.return_value = mock_delete_resp

        # Step 3: Verification GET -> 404
        err_404 = urllib.error.HTTPError(
            url="https://management.azure.com/...",
            code=404,
            msg="NotFound",
            hdrs={},
            fp=io.BytesIO(b'{"error":{"code":"ResourceNotFound"}}')
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.side_effect = [
                mock_preflight_resp,
                mock_delete_resp,
                err_404
            ]

            record = execute_azure_live_remediation(
                subscription_id="sub-123",
                action_type="azure:network/publicIPAddresses/delete",
                resource_id=pip_id,
                parameters=params,
                oauth_token="bearer-token-123"
            )

            self.assertEqual(record.state, "succeeded")
            self.assertEqual(record.verification_status, "verified")
            self.assertEqual(record.aws_request_id, "req-arm-del-pip-002")
            self.assertIn("DELETED ($0.00/mo ✓)", record.after_state)

    # ── 3. Public IP Guard: Attached IP Fails Pre-Flight ──
    def test_remediate_attached_public_ip_blocked_by_preflight(self):
        pip_id = "/subscriptions/sub-123/resourceGroups/rg-test/providers/Microsoft.Network/publicIPAddresses/pip-attached"
        params = {
            "resource_group": "rg-test",
            "public_ip_name": "pip-attached"
        }

        # Preflight shows IP is actively bound to a NIC!
        mock_preflight_resp = MagicMock()
        mock_preflight_resp.read.return_value = json.dumps({
            "name": "pip-attached",
            "properties": {
                "ipAddress": "20.10.15.21",
                "ipConfiguration": {"id": "/subscriptions/sub-123/.../nic-web/ipConfigurations/ipconfig1"}
            }
        }).encode("utf-8")
        mock_preflight_resp.__enter__.return_value = mock_preflight_resp

        with patch("urllib.request.urlopen", return_value=mock_preflight_resp):
            with self.assertRaises(AzureRemediationPreflightError) as ctx:
                execute_azure_live_remediation(
                    subscription_id="sub-123",
                    action_type="azure:network/publicIPAddresses/delete",
                    resource_id=pip_id,
                    parameters=params,
                    oauth_token="bearer-token-123"
                )
            self.assertIn("associated with a network interface", str(ctx.exception))

    # ── 4. Unattached Managed Disk Verified Deletion ──
    def test_remediate_unattached_disk_success(self):
        disk_id = "/subscriptions/sub-123/resourceGroups/rg-test/providers/Microsoft.Compute/disks/disk-idle"
        params = {
            "resource_group": "rg-test",
            "disk_name": "disk-idle"
        }

        # Pre-flight GET confirms managedBy is None
        mock_preflight_resp = MagicMock()
        mock_preflight_resp.read.return_value = json.dumps({
            "name": "disk-idle",
            "managedBy": None,
            "properties": {"diskSizeGB": 32}
        }).encode("utf-8")
        mock_preflight_resp.__enter__.return_value = mock_preflight_resp

        mock_delete_resp = MagicMock()
        mock_delete_resp.status = 200
        mock_delete_resp.read.return_value = b""
        mock_delete_resp.headers = {"x-ms-request-id": "req-arm-del-disk-003"}
        mock_delete_resp.__enter__.return_value = mock_delete_resp

        err_404 = urllib.error.HTTPError(
            url="https://management.azure.com/...",
            code=404,
            msg="NotFound",
            hdrs={},
            fp=io.BytesIO(b'{"error":{"code":"ResourceNotFound"}}')
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.side_effect = [
                mock_preflight_resp,
                mock_delete_resp,
                err_404
            ]

            record = execute_azure_live_remediation(
                subscription_id="sub-123",
                action_type="azure:compute/disks/delete",
                resource_id=disk_id,
                parameters=params,
                oauth_token="bearer-token-123"
            )

            self.assertEqual(record.state, "succeeded")
            self.assertEqual(record.verification_status, "verified")
            self.assertEqual(record.aws_request_id, "req-arm-del-disk-003")
            self.assertIn("DELETED ($0.00/mo ✓)", record.after_state)

    def test_remediate_attached_disk_blocked_by_preflight(self):
        disk_id = "/subscriptions/sub-123/resourceGroups/rg-test/providers/Microsoft.Compute/disks/disk-os"
        params = {
            "resource_group": "rg-test",
            "disk_name": "disk-os"
        }

        # Pre-flight GET shows disk attached to VM
        mock_preflight_resp = MagicMock()
        mock_preflight_resp.read.return_value = json.dumps({
            "name": "disk-os",
            "managedBy": "/subscriptions/sub-123/.../virtualMachines/vm-prod-01",
            "properties": {"diskSizeGB": 128}
        }).encode("utf-8")
        mock_preflight_resp.__enter__.return_value = mock_preflight_resp

        with patch("urllib.request.urlopen", return_value=mock_preflight_resp):
            with self.assertRaises(AzureRemediationPreflightError) as ctx:
                execute_azure_live_remediation(
                    subscription_id="sub-123",
                    action_type="azure:compute/disks/delete",
                    resource_id=disk_id,
                    parameters=params,
                    oauth_token="bearer-token-123"
                )
            self.assertIn("attached to virtual machine", str(ctx.exception))

    # ── 5. Storage Account Public Access Patch ──
    def test_remediate_storage_account_public_access_patch_success(self):
        stg_id = "/subscriptions/sub-123/resourceGroups/rg-test/providers/Microsoft.Storage/storageAccounts/stgtest"
        params = {
            "resource_group": "rg-test",
            "account_name": "stgtest"
        }

        # Step 1: Pre-flight GET confirms allowBlobPublicAccess is True
        mock_preflight_resp = MagicMock()
        mock_preflight_resp.read.return_value = json.dumps({
            "name": "stgtest",
            "properties": {"allowBlobPublicAccess": True}
        }).encode("utf-8")
        mock_preflight_resp.__enter__.return_value = mock_preflight_resp

        # Step 2: PATCH -> 200
        mock_patch_resp = MagicMock()
        mock_patch_resp.status = 200
        mock_patch_resp.read.return_value = b'{"properties": {"allowBlobPublicAccess": false}}'
        mock_patch_resp.headers = {"x-ms-request-id": "req-arm-patch-stg-004"}
        mock_patch_resp.__enter__.return_value = mock_patch_resp

        # Step 3: Verification GET confirms allowBlobPublicAccess is now False
        mock_verify_resp = MagicMock()
        mock_verify_resp.read.return_value = json.dumps({
            "name": "stgtest",
            "properties": {"allowBlobPublicAccess": False}
        }).encode("utf-8")
        mock_verify_resp.__enter__.return_value = mock_verify_resp

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.side_effect = [
                mock_preflight_resp,
                mock_patch_resp,
                mock_verify_resp
            ]

            record = execute_azure_live_remediation(
                subscription_id="sub-123",
                action_type="azure:storage/storageAccounts/patch",
                resource_id=stg_id,
                parameters=params,
                oauth_token="bearer-token-123"
            )

            self.assertEqual(record.state, "succeeded")
            self.assertEqual(record.verification_status, "verified")
            self.assertEqual(record.aws_request_id, "req-arm-patch-stg-004")
            self.assertIn("allowBlobPublicAccess=False (VERIFIED ✓)", record.after_state)

    # ── 6. AI Explainer for Azure Findings ──
    def test_ai_explainer_azure_nsg_rule(self):
        finding = FindingModel(
            id="az-finding-nsg-01",
            title="Azure NSG Inbound SSH Exposed",
            description="NSG allows port 22",
            severity="critical",
            status="active",
            category="security",
            resource=ResourceModel(
                id="/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Network/networkSecurityGroups/nsg-1/securityRules/Allow-SSH",
                name="nsg-1",
                type="Azure NSG Rule",
                region="eastus",
                age="1d"
            ),
            rule="AZ-SEC-NSG-001",
            operation="azure:network/networkSecurityGroups/securityRules/delete",
            execution_mode="live",
            evidence=["ARM discovery observed inbound rule 'Allow-SSH' with destination port 22 open to '*'."],
            detectedAt="2026-10-23T20:00:00Z",
            affectedService="Network Security Group",
            recommendedAction="Delete insecure security rule from NSG.",
            beforeState="Allow-SSH: Inbound TCP:22 from *",
            afterState="Rule deleted",
            metadata={
                "resource_group": "rg-1",
                "nsg_name": "nsg-1",
                "rule_name": "Allow-SSH",
                "destination_port": "22",
                "source_address_prefix": "*"
            }
        )

        explanation = generate_finding_explanation(finding)
        self.assertEqual(explanation.finding_id, "az-finding-nsg-01")
        self.assertTrue(explanation.is_action_supported_by_engine)
        self.assertEqual(explanation.evidence_provenance, "Live Azure Resource Manager (ARM) Telemetry")
        self.assertIn("Network Security Group", explanation.root_cause_analysis)
        self.assertIn("Allow-SSH", explanation.root_cause_analysis)
        self.assertTrue(any("Rollback: az network nsg rule create" in u for u in explanation.uncertainty_and_limitations))

    def test_ai_explainer_azure_idle_public_ip(self):
        finding = FindingModel(
            id="az-finding-pip-01",
            title="Unassociated Azure Public IP",
            description="Public IP idle",
            severity="medium",
            status="active",
            category="cost",
            resource=ResourceModel(
                id="/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Network/publicIPAddresses/pip-idle",
                name="pip-idle",
                type="Azure Public IP",
                region="eastus",
                age="1d"
            ),
            rule="AZ-COST-PIP-001",
            operation="azure:network/publicIPAddresses/delete",
            execution_mode="live",
            estimatedMonthlyCost=3.60,
            evidence=["ARM discovery observed Public IP 'pip-idle' (20.10.15.20) with null ipConfiguration."],
            detectedAt="2026-10-23T20:00:00Z",
            affectedService="Public IP Addresses",
            recommendedAction="Delete unassociated Public IP address.",
            beforeState="Public IP: Allocated (Unassociated)",
            afterState="Public IP: Deleted",
            metadata={
                "resource_group": "rg-1",
                "public_ip_name": "pip-idle",
                "ip_address": "20.10.15.20"
            }
        )

        explanation = generate_finding_explanation(finding)
        self.assertEqual(explanation.finding_id, "az-finding-pip-01")
        self.assertTrue(explanation.is_action_supported_by_engine)
        self.assertEqual(explanation.evidence_provenance, "Live Azure Resource Manager (ARM) Telemetry")
        self.assertIn("pip-idle", explanation.root_cause_analysis)
        self.assertIn("idle public IPv4", explanation.root_cause_analysis)
        self.assertIn("$3.60/mo", str(explanation.observed_facts))


if __name__ == "__main__":
    unittest.main()
