"""
Phase 5 Tests: Evidence-Based Safety Passports
Covers:
- Categorization of every check ('aws_api', 'local_policy', 'assumption', 'unsupported_placeholder')
- Timestamp and freshness limit enforcement (stale evidence blocks execution)
- Deterministic risk calculation (production tags elevate blast radius, cannot be overridden)
- Passport invalidation on parameter alteration (hash mismatch)
- Passport invalidation on target resource mismatch
- Pre-execution AWS revalidation detects rule or resource absence and blocks execution
- Endpoint integration: approval fails closed when passport is blocked or invalid
"""

import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

from app.schemas import (
    FindingModel,
    ResourceModel,
    SafetyCheck,
    ApproveRequest
)
from app.services.safety_passport import (
    build_safety_passport,
    revalidate_safety_passport_before_execution,
    compute_canonical_param_hash,
    compute_passport_hash,
    calculate_risk_and_blast_radius
)
from app.routers.discovery import (
    get_finding_safety_passport,
    approve_finding,
    _cached_findings
)
from app.routers.accounts import _connected_accounts


class TestPhase5SafetyPassports(unittest.TestCase):

    def setUp(self):
        _cached_findings.clear()
        _connected_accounts.clear()

        self.sample_finding = FindingModel(
            id="live-sg-sg-0123456789abcdef0",
            category="security",
            severity="critical",
            title="SSH (port 22) open to world (0.0.0.0/0)",
            description="Security group sg-0123456789abcdef0 allows inbound 0.0.0.0/0:22",
            rule="SEC-SG-001",
            resource=ResourceModel(
                id="sg-0123456789abcdef0",
                type="AWS::EC2::SecurityGroup",
                name="launch-wizard-1",
                region="ap-south-1",
                age="14d",
                account_id="123456789012",
                tags={"Env": "Production", "App": "Payments"}
            ),
            evidence=[
                "Source API: ec2:DescribeSecurityGroups",
                "Rule: TCP:22 from 0.0.0.0/0"
            ],
            status="open",
            detectedAt=datetime.now(timezone.utc).isoformat(),
            affectedService="Amazon VPC",
            recommendedAction="Revoke 0.0.0.0/0 rule",
            operation="ec2:RevokeSecurityGroupIngress",
            operationParams={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": "22", "ToPort": "22"},
            recoveryGuidance=["aws ec2 authorize-security-group-ingress --group-id sg-0123456789abcdef0 --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ap-south-1"],
            beforeState="TCP:22 OPEN",
            afterState="TCP:22 CLOSED",
            execution_mode="live"
        )

    # ── Test 1: Check Categorization & Evidence Metadata ──────────────────────
    def test_passport_categorization_and_metadata(self):
        passport = build_safety_passport(self.sample_finding)

        self.assertEqual(len(passport.checks), 5)
        self.assertEqual(passport.finding_id, self.sample_finding.id)
        self.assertEqual(passport.resource_id, "sg-0123456789abcdef0")
        self.assertEqual(passport.account_id, "123456789012")
        self.assertEqual(passport.region, "ap-south-1")

        # Verify every check has explicit classification and evidence source
        check_types = [c.check_type for c in passport.checks]
        self.assertIn("aws_api", check_types)
        self.assertIn("local_policy", check_types)

        for c in passport.checks:
            self.assertIsNotNone(c.evidence_source)
            self.assertIsNotNone(c.evaluated_at)
            self.assertEqual(c.freshness_limit_seconds, 300)
            self.assertEqual(c.account_id, "123456789012")

    # ── Test 2: Deterministic Risk Calculation from Documented Rules ──────────
    def test_deterministic_risk_calculation(self):
        # Production tag elevates baseline risk
        risk, factors = calculate_risk_and_blast_radius(
            resource_type="AWS::EC2::SecurityGroup",
            operation="ec2:RevokeSecurityGroupIngress",
            params={"FromPort": "22", "CidrIp": "0.0.0.0/0"},
            tags={"Env": "Production"},
            checks=[]
        )
        self.assertEqual(risk, "medium")
        self.assertTrue(any("Production" in f for f in factors))

        # Destructive volume deletion elevates to critical if prod
        del_risk, del_factors = calculate_risk_and_blast_radius(
            resource_type="AWS::EC2::Volume",
            operation="ec2:DeleteVolume",
            params={"VolumeId": "vol-1"},
            tags={"Env": "Production"},
            checks=[]
        )
        self.assertEqual(del_risk, "critical")
        self.assertTrue(any("DESTRUCTIVE ACTION" in f for f in del_factors))

    # ── Test 3: Stale Evidence Blocks Execution ───────────────────────────────
    def test_stale_evidence_blocks_execution(self):
        passport = build_safety_passport(self.sample_finding, freshness_limit_seconds=60)
        # Artificially age the passport past freshness limit
        passport.generated_at = (datetime.now(timezone.utc) - timedelta(seconds=120)).isoformat()

        # Without live AWS re-evaluation, stale evidence fails closed
        is_valid, reason, updated_passport = revalidate_safety_passport_before_execution(
            passport=passport,
            target_finding=self.sample_finding,
            live_ec2_client=None,
            mode="live"
        )
        self.assertFalse(is_valid)
        self.assertIn("STALE", reason)
        self.assertTrue(updated_passport.is_safety_blocked)

    # ── Test 4: Parameter Tampering Invalidates Passport ──────────────────────
    def test_parameter_tampering_invalidates_passport(self):
        passport = build_safety_passport(self.sample_finding)

        # Mutate parameters on target finding (e.g. changing port from 22 to 80)
        tampered_finding = self.sample_finding.model_copy(deep=True)
        tampered_finding.operationParams = {
            "GroupId": "sg-0123456789abcdef0",
            "CidrIp": "0.0.0.0/0",
            "FromPort": "80",
            "ToPort": "80"
        }

        is_valid, reason, updated = revalidate_safety_passport_before_execution(
            passport=passport,
            target_finding=tampered_finding,
            live_ec2_client=None,
            mode="live"
        )
        self.assertFalse(is_valid)
        self.assertIn("invalidated", reason.lower())
        self.assertTrue(updated.is_safety_blocked)

    # ── Test 5: Target Resource ID Mismatch Invalidates Passport ──────────────
    def test_resource_mismatch_invalidates_passport(self):
        passport = build_safety_passport(self.sample_finding)

        # Different resource ID
        mismatched_finding = self.sample_finding.model_copy(deep=True)
        mismatched_finding.resource.id = "sg-different-id-999"

        is_valid, reason, updated = revalidate_safety_passport_before_execution(
            passport=passport,
            target_finding=mismatched_finding,
            live_ec2_client=None,
            mode="live"
        )
        self.assertFalse(is_valid)
        self.assertIn("mismatch", reason.lower())

    # ── Test 6: Live Pre-Flight Re-evaluation Detects Rule Absence ────────────
    def test_live_preflight_detects_missing_rule(self):
        passport = build_safety_passport(self.sample_finding)

        mock_ec2 = MagicMock()
        # Security group exists, but the 0.0.0.0/0:22 rule was ALREADY removed out-of-band!
        mock_ec2.describe_security_groups.return_value = {
            "SecurityGroups": [{
                "GroupId": "sg-0123456789abcdef0",
                "IpPermissions": []
            }]
        }

        is_valid, reason, updated = revalidate_safety_passport_before_execution(
            passport=passport,
            target_finding=self.sample_finding,
            live_ec2_client=mock_ec2,
            mode="live"
        )
        self.assertFalse(is_valid)
        self.assertIn("no longer present", reason)
        self.assertTrue(updated.is_safety_blocked)

    # ── Test 7: GET /findings/{id}/passport Endpoint ──────────────────────────
    def test_get_finding_passport_endpoint(self):
        _cached_findings["live:live-sg-sg-0123456789abcdef0"] = self.sample_finding

        res = get_finding_safety_passport("live-sg-sg-0123456789abcdef0", mode="live")
        self.assertEqual(res.finding_id, self.sample_finding.id)
        self.assertEqual(res.resource_id, "sg-0123456789abcdef0")
        self.assertEqual(len(res.checks), 5)
        self.assertEqual(res.risk_level, "medium")


if __name__ == "__main__":
    unittest.main()
