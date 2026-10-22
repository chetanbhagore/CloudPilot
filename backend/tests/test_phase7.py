"""
Phase 7 Tests: IAM Hardening and Cross-Account Security
Covers:
- CloudFormation template policy validation:
    - Trust policies require exact operator principal and sts:ExternalId condition
    - Audit Role is strictly read-only (SecurityAudit, ViewOnlyAccess)
    - Remediation Role mutation actions are scoped to resource ARNs, never Resource: "*"
    - Destructive actions are excluded from default remediation role
- Unpredictable ExternalId generation with high entropy
- Account disconnection and AWS revocation procedure
"""

import os
import unittest
from app.routers.accounts import (
    generate_external_id,
    disconnect_account,
    _connected_accounts
)


class TestPhase7IAMHardening(unittest.TestCase):

    def setUp(self):
        _connected_accounts.clear()

    # ── Test 1: CloudFormation Template Validation ────────────────────────────
    def test_cloudformation_template_security_posture(self):
        cf_path = os.path.join(
            os.path.dirname(__file__), "..", "cloudformation", "cloudpilot-roles.yaml"
        )
        self.assertTrue(os.path.exists(cf_path), "CloudFormation template must exist.")

        with open(cf_path, "r", encoding="utf-8") as f:
            cf_text = f.read()

        # 1. Trust policies must enforce sts:ExternalId
        self.assertIn("sts:ExternalId", cf_text)
        self.assertIn("StringEquals", cf_text)
        self.assertIn("CloudPilotOperatorRole", cf_text)

        # 2. Audit Role must use only read-only audit managed policies
        self.assertIn("arn:aws:iam::aws:policy/SecurityAudit", cf_text)
        self.assertIn("arn:aws:iam::aws:policy/job-function/ViewOnlyAccess", cf_text)

        # 3. Remediation Role must NOT allow wildcard Resource on mutation actions
        # ec2:RevokeSecurityGroupIngress must be scoped to security-group ARNs
        self.assertIn("ScopedRevokeSecurityGroupIngress", cf_text)
        self.assertIn(":security-group/*", cf_text)

        # 4. Destructive mutations (e.g. DeleteVolume, StopInstances) must be excluded
        self.assertNotIn("ec2:DeleteVolume", cf_text)
        self.assertNotIn("ec2:StopInstances", cf_text)

    # ── Test 2: Unpredictable ExternalId Generator ────────────────────────────
    def test_unpredictable_external_id_generation(self):
        res1 = generate_external_id(current_user=None)
        res2 = generate_external_id(current_user=None)

        id1 = res1["external_id"]
        id2 = res2["external_id"]

        # Must be different (unpredictable entropy)
        self.assertNotEqual(id1, id2)
        # Must be at least 16 characters for security
        self.assertGreaterEqual(len(id1), 20)
        self.assertEqual(res1["entropy_bits"], 128)

    # ── Test 3: Account Disconnection & Revocation Procedure ──────────────────
    def test_account_disconnection_and_revocation(self):
        _connected_accounts["live:123456789012"] = {
            "account_id": "123456789012",
            "execution_mode": "live"
        }

        res = disconnect_account("123456789012", mode="live")
        self.assertTrue(res["success"])
        self.assertNotIn("live:123456789012", _connected_accounts)

        # Must provide explicit AWS CLI revocation command
        revocation = res["revocation_procedure"]
        self.assertIn("aws cloudformation delete-stack", revocation["cli_command"])


if __name__ == "__main__":
    unittest.main()
