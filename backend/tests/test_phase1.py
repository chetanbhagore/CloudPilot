import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas import (
    AccountConnectRequest,
    DiscoveryRequest,
    FindingModel,
    ExecutionMode
)
from app.services.aws_sts import (
    assume_role,
    generate_demo_sts_session,
    validate_role_arn,
    STSConfigurationError,
    STSAssumeRoleError,
    STSAccountMismatchError,
    STSValidationError
)
from app.services.aws_discovery import (
    scan_account_live,
    get_demo_scenario_findings
)
from app.routers.accounts import connect_account, _connected_accounts
from app.routers.discovery import run_discovery_scan, get_findings, _cached_findings

class TestPhase1LiveDemoSeparation(unittest.TestCase):
    def setUp(self):
        _connected_accounts.clear()
        _cached_findings.clear()

    # ── Test 1: Demo mode is isolated and clearly labeled ────────────────────────
    def test_demo_mode_isolated_and_labeled(self):
        demo_session = generate_demo_sts_session(
            account_id="123456789012",
            session_name="DemoTestSession"
        )
        self.assertTrue(demo_session["is_simulated"])
        self.assertEqual(demo_session["execution_mode"], "demo")
        self.assertIn("DEMO-SIMULATED", demo_session["access_key_id"])

        demo_findings = get_demo_scenario_findings("fintech", "123456789012", "ap-south-1")
        self.assertGreater(len(demo_findings), 0)
        for f in demo_findings:
            self.assertEqual(f.execution_mode, "demo")
            self.assertEqual(f.data_source, "demo_fixture")
            self.assertIn("[DEMO SIMULATION]", f.title)

    # ── Test 2: Live mode fails closed with no credentials ───────────────────────
    def test_live_sts_fails_closed_without_credentials(self):
        # When environment has no AWS credentials, live assume_role MUST raise STSError
        # It must NEVER fall back to simulated credentials
        with patch.dict(os.environ, {}, clear=True):
            with patch("boto3.client") as mock_client:
                mock_sts = MagicMock()
                from botocore.exceptions import NoCredentialsError
                mock_sts.get_caller_identity.side_effect = NoCredentialsError()
                mock_client.return_value = mock_sts

                with self.assertRaises(STSConfigurationError) as ctx:
                    assume_role(
                        role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
                        external_id="tenant-external-id-1234",
                        expected_account_id="123456789012"
                    )
                self.assertIn("valid AWS credentials", str(ctx.exception))

    # ── Test 3: Live mode fails closed when AssumeRole is AccessDenied ───────────
    def test_live_sts_fails_on_access_denied(self):
        with patch("boto3.client") as mock_client:
            mock_sts = MagicMock()
            mock_sts.get_caller_identity.return_value = {"Arn": "arn:aws:iam::999999999999:user/operator"}
            from botocore.exceptions import ClientError
            mock_sts.assume_role.side_effect = ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "User is not authorized to perform sts:AssumeRole"}},
                "AssumeRole"
            )
            mock_client.return_value = mock_sts

            with self.assertRaises(STSAssumeRoleError) as ctx:
                assume_role(
                    role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
                    external_id="tenant-external-id-1234",
                    expected_account_id="123456789012"
                )
            self.assertIn("AccessDenied", str(ctx.exception))

    # ── Test 4: Account mismatch detection ───────────────────────────────────────
    def test_account_id_mismatch_rejected(self):
        with self.assertRaises(STSAccountMismatchError):
            validate_role_arn(
                role_arn="arn:aws:iam::111111111111:role/CloudPilotAuditRole",
                expected_account_id="222222222222"
            )

    # ── Test 5: Role ARN validation ──────────────────────────────────────────────
    def test_invalid_role_arn_rejected(self):
        with self.assertRaises(STSValidationError):
            validate_role_arn("not-an-arn")

    # ── Test 6: Live scanner refuses simulated credentials ───────────────────────
    def test_live_scanner_refuses_simulated_credentials(self):
        simulated_creds = {
            "access_key_id": "ASIAFAKE",
            "secret_access_key": "fake",
            "is_simulated": True,
            "execution_mode": "demo"
        }
        with self.assertRaises(ValueError) as ctx:
            scan_account_live("123456789012", "ap-south-1", simulated_creds)
        self.assertIn("simulated/demo credentials", str(ctx.exception))

    # ── Test 7: Empty live scan returns empty list (never fallback data) ─────────
    def test_live_scan_empty_results_stays_empty(self):
        mock_ec2 = MagicMock()
        mock_ec2.describe_security_groups.return_value = {"SecurityGroups": []}
        
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [{"Volumes": []}]
        mock_ec2.get_paginator.return_value = mock_paginator

        live_creds = {
            "access_key_id": "AKIAREALKEYEXAMPLE",
            "secret_access_key": "realsecret",
            "session_token": "token",
            "is_simulated": False,
            "execution_mode": "live"
        }

        with patch("app.services.aws_discovery.get_ec2_client", return_value=mock_ec2):
            findings, count, successful, failed, errors = scan_account_live("123456789012", "ap-south-1", live_creds)
            self.assertEqual(len(findings), 0)
            self.assertEqual(findings, [])
            self.assertEqual(count, 0)
            self.assertEqual(successful, ["ap-south-1"])

    # ── Test 8: Live findings endpoint returns empty when cache is empty ─────────
    def test_live_findings_endpoint_does_not_auto_seed(self):
        res = get_findings(mode="live")
        self.assertEqual(res, [])

        # Conversely, demo mode provides demo seeds
        demo_res = get_findings(mode="demo")
        self.assertGreater(len(demo_res), 0)
        self.assertEqual(demo_res[0].execution_mode, "demo")

    # ── Test 9: Accounts connect router rejects invalid account ID ───────────────
    def test_accounts_connect_router_validates_input(self):
        from fastapi import HTTPException
        req = AccountConnectRequest(
            account_id="invalid-id",
            role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
            external_id="cp-ext-1234",
            mode="live"
        )
        with self.assertRaises(HTTPException) as ctx:
            connect_account(req)
        self.assertEqual(ctx.exception.status_code, 400)

if __name__ == "__main__":
    unittest.main()
