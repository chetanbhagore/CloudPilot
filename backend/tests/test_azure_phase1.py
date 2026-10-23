"""
Phase 1 Tests: Azure Multi-Cloud Foundation & Real Discovery
Validates:
- Microsoft Entra ID OAuth2 token exchange and pre-expiry caching
- Azure subscription verification
- Real ARM REST Discovery:
  - AZ-SEC-NSG-001: Inbound SSH (22) open to world in NSG
  - AZ-SEC-NSG-002: Inbound RDP (3389) open to world in NSG
  - AZ-COST-DISK-001: Unattached Azure Managed Disk idle cost detection
  - AZ-COST-PIP-001: Unassociated Azure Public IP address detection
  - AZ-SEC-STORAGE-001: Storage Account with public blob access allowed
- End-to-end Safety Passport generation for Azure findings
"""

import unittest
from unittest.mock import MagicMock, patch
import os
import sys
import json
import io
import urllib.error

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.azure_auth import (
    get_azure_oauth_token,
    verify_azure_subscription,
    connect_azure_account,
    azure_token_cache,
    AzureTokenError,
    AzureSubscriptionError
)
from app.services.azure_discovery import (
    scan_azure_subscription_live,
    calculate_azure_disk_cost
)


class TestAzurePhase1(unittest.TestCase):

    def setUp(self):
        azure_token_cache.clear()

    # ── 1. OAuth2 Client Credentials Token Handshake ──
    def test_token_exchange_success_and_caching(self):
        mock_resp_data = {
            "access_token": "mock-azure-jwt-bearer-token-12345",
            "expires_in": 3600,
            "token_type": "Bearer"
        }
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_resp_data).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp

        with patch("urllib.request.urlopen", return_value=mock_resp) as mock_urlopen:
            token = get_azure_oauth_token(
                tenant_id="tenant-123",
                client_id="client-456",
                client_secret="secret-789"
            )
            self.assertEqual(token, "mock-azure-jwt-bearer-token-12345")
            mock_urlopen.assert_called_once()

            # Second call should hit in-memory token cache (no HTTP call)
            cached_token = get_azure_oauth_token(
                tenant_id="tenant-123",
                client_id="client-456",
                client_secret="secret-789"
            )
            self.assertEqual(cached_token, "mock-azure-jwt-bearer-token-12345")
            self.assertEqual(mock_urlopen.call_count, 1)

    def test_token_exchange_handles_invalid_credentials(self):
        http_err = urllib.error.HTTPError(
            url="https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=io.BytesIO(b'{"error": "invalid_client", "error_description": "Invalid client secret provided."}')
        )

        with patch("urllib.request.urlopen", side_effect=http_err):
            with self.assertRaises(AzureTokenError) as ctx:
                get_azure_oauth_token("tenant-123", "client-456", "bad-secret")
            self.assertIn("Invalid client secret provided", str(ctx.exception))

    # ── 2. Subscription Verification ──
    def test_verify_subscription_success(self):
        mock_sub_data = {
            "id": "/subscriptions/sub-12345-abcde",
            "subscriptionId": "sub-12345-abcde",
            "displayName": "Azure for Students (CS Lab)",
            "state": "Enabled"
        }
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_sub_data).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp

        with patch("urllib.request.urlopen", return_value=mock_resp):
            info = verify_azure_subscription("sub-12345-abcde", "token-xyz")
            self.assertEqual(info["subscription_id"], "sub-12345-abcde")
            self.assertEqual(info["display_name"], "Azure for Students (CS Lab)")
            self.assertEqual(info["state"], "Enabled")

    def test_connect_azure_account_orchestration(self):
        with patch("app.services.azure_auth.get_azure_oauth_token", return_value="jwt-token-ok"), \
             patch("app.services.azure_auth.verify_azure_subscription", return_value={
                 "subscription_id": "sub-test-999",
                 "display_name": "Student Subscription",
                 "state": "Enabled",
                 "verified_at": "2026-10-23T20:00:00Z"
             }):
            res = connect_azure_account(
                tenant_id="ten-1",
                client_id="cli-1",
                client_secret="sec-1",
                subscription_id="sub-test-999"
            )
            self.assertEqual(res["cloud_provider"], "azure")
            self.assertEqual(res["subscription_id"], "sub-test-999")
            self.assertEqual(res["display_name"], "Student Subscription")
            self.assertTrue(res["is_live"])

    # ── 3. Real ARM REST Discovery Engine ──
    def test_discovery_detects_open_ssh_and_rdp_in_nsg(self):
        mock_nsg_payload = {
            "value": [
                {
                    "id": "/subscriptions/sub-test/resourceGroups/rg-web/providers/Microsoft.Network/networkSecurityGroups/nsg-frontend",
                    "name": "nsg-frontend",
                    "location": "eastus",
                    "properties": {
                        "securityRules": [
                            {
                                "name": "allow-ssh-world",
                                "id": "/subscriptions/sub-test/.../allow-ssh-world",
                                "properties": {
                                    "protocol": "Tcp",
                                    "sourceAddressPrefix": "*",
                                    "destinationPortRange": "22",
                                    "access": "Allow",
                                    "priority": 100,
                                    "direction": "Inbound"
                                }
                            },
                            {
                                "name": "allow-rdp-internet",
                                "id": "/subscriptions/sub-test/.../allow-rdp-internet",
                                "properties": {
                                    "protocol": "Tcp",
                                    "sourceAddressPrefix": "Internet",
                                    "destinationPortRange": "3389",
                                    "access": "Allow",
                                    "priority": 110,
                                    "direction": "Inbound"
                                }
                            }
                        ]
                    }
                }
            ]
        }

        def arm_get_dispatcher(url, token):
            if "networkSecurityGroups" in url:
                return mock_nsg_payload
            return {"value": []}

        with patch("app.services.azure_discovery._execute_arm_get", side_effect=arm_get_dispatcher):
            findings, count, success_svcs, fail_svcs, errors = scan_azure_subscription_live(
                subscription_id="sub-test",
                access_token="valid-token"
            )

            ssh_findings = [f for f in findings if f.rule.startswith("AZ-SEC-NSG-001")]
            rdp_findings = [f for f in findings if f.rule.startswith("AZ-SEC-NSG-002")]

            self.assertEqual(len(ssh_findings), 1)
            self.assertEqual(ssh_findings[0].severity, "critical")
            self.assertEqual(ssh_findings[0].operation, "azure:network/networkSecurityGroups/securityRules/delete")
            self.assertIsNotNone(ssh_findings[0].passport)
            self.assertEqual(ssh_findings[0].passport.account_id, "sub-test")

            self.assertEqual(len(rdp_findings), 1)
            self.assertEqual(rdp_findings[0].severity, "critical")

    def test_discovery_detects_unattached_managed_disk_with_cost(self):
        mock_disks_payload = {
            "value": [
                {
                    "id": "/subscriptions/sub-test/resourceGroups/rg-data/providers/Microsoft.Compute/disks/disk-orphan-db",
                    "name": "disk-orphan-db",
                    "location": "centralindia",
                    "sku": {"name": "StandardSSD_LRS"},
                    "properties": {
                        "diskSizeGB": 128,
                        "diskState": "Unattached",
                        "managedBy": None
                    }
                }
            ]
        }

        def arm_get_dispatcher(url, token):
            if "disks" in url:
                return mock_disks_payload
            return {"value": []}

        with patch("app.services.azure_discovery._execute_arm_get", side_effect=arm_get_dispatcher):
            findings, count, success_svcs, fail_svcs, errors = scan_azure_subscription_live(
                subscription_id="sub-test",
                access_token="valid-token"
            )

            disk_findings = [f for f in findings if f.rule.startswith("AZ-COST-DISK-001")]
            self.assertEqual(len(disk_findings), 1)
            self.assertEqual(disk_findings[0].category, "cost")
            self.assertEqual(disk_findings[0].resource.id, "/subscriptions/sub-test/resourceGroups/rg-data/providers/Microsoft.Compute/disks/disk-orphan-db")
            # 128GB Standard SSD @ $0.075/GB = $9.60/month
            self.assertAlmostEqual(disk_findings[0].estimatedMonthlyCost, 9.60, places=1)
            self.assertEqual(disk_findings[0].estimatedSavings, disk_findings[0].estimatedMonthlyCost)

    def test_discovery_detects_unassociated_public_ip(self):
        mock_pip_payload = {
            "value": [
                {
                    "id": "/subscriptions/sub-test/resourceGroups/rg-net/providers/Microsoft.Network/publicIPAddresses/pip-idle-nat",
                    "name": "pip-idle-nat",
                    "location": "eastus",
                    "properties": {
                        "ipAddress": "20.120.45.67",
                        "ipConfiguration": None
                    }
                }
            ]
        }

        def arm_get_dispatcher(url, token):
            if "publicIPAddresses" in url:
                return mock_pip_payload
            return {"value": []}

        with patch("app.services.azure_discovery._execute_arm_get", side_effect=arm_get_dispatcher):
            findings, count, success_svcs, fail_svcs, errors = scan_azure_subscription_live(
                subscription_id="sub-test",
                access_token="valid-token"
            )

            pip_findings = [f for f in findings if f.rule.startswith("AZ-COST-PIP-001")]
            self.assertEqual(len(pip_findings), 1)
            self.assertEqual(pip_findings[0].category, "cost")
            self.assertEqual(pip_findings[0].estimatedMonthlyCost, 3.60)
            self.assertEqual(pip_findings[0].operation, "azure:network/publicIPAddresses/delete")

    def test_discovery_detects_public_blob_storage_account(self):
        mock_storage_payload = {
            "value": [
                {
                    "id": "/subscriptions/sub-test/resourceGroups/rg-store/providers/Microsoft.Storage/storageAccounts/stpublicassets123",
                    "name": "stpublicassets123",
                    "location": "eastus",
                    "properties": {
                        "allowBlobPublicAccess": True
                    }
                }
            ]
        }

        def arm_get_dispatcher(url, token):
            if "storageAccounts" in url:
                return mock_storage_payload
            return {"value": []}

        with patch("app.services.azure_discovery._execute_arm_get", side_effect=arm_get_dispatcher):
            findings, count, success_svcs, fail_svcs, errors = scan_azure_subscription_live(
                subscription_id="sub-test",
                access_token="valid-token"
            )

            storage_findings = [f for f in findings if f.rule.startswith("AZ-SEC-STORAGE-001")]
            self.assertEqual(len(storage_findings), 1)
            self.assertEqual(storage_findings[0].severity, "critical")
            self.assertEqual(storage_findings[0].operation, "azure:storage/storageAccounts/patch")
            self.assertIn("allowBlobPublicAccess is True", storage_findings[0].evidence[2])


if __name__ == "__main__":
    unittest.main()
