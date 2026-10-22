"""
Phase 13: Dedicated Opt-In Live AWS Integration Test Suite
Non-negotiable Rules:
- STRICTLY OPT-IN: Must skip by default unless CLOUDPILOT_TEST_LIVE_AWS=true is set.
- NEVER make destructive AWS calls in automated CI or test runs.
- Only exercises read-only verification: STS caller identity and read-only resource descriptors.
"""

import os
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import boto3
from app.services.aws_sts import assume_role, validate_role_arn
from app.services.aws_discovery import scan_account_live


@unittest.skipUnless(
    os.getenv("CLOUDPILOT_TEST_LIVE_AWS") == "true",
    "Opt-in live AWS integration test. Skipped by default. Set CLOUDPILOT_TEST_LIVE_AWS=true and configure test AWS credentials to run."
)
class TestLiveAWSIntegrationOptIn(unittest.TestCase):
    """
    Opt-in test suite for dedicated non-production AWS test environments.
    Only exercises read-only APIs.
    """

    def setUp(self):
        self.test_role_arn = os.getenv("CLOUDPILOT_TEST_ROLE_ARN")
        self.test_account_id = os.getenv("CLOUDPILOT_TEST_ACCOUNT_ID")
        self.test_external_id = os.getenv("CLOUDPILOT_TEST_EXTERNAL_ID", "cloudpilot-optin-test")

    def test_live_sts_caller_identity(self):
        """Verifies operator credentials can reach AWS STS safely."""
        sts = boto3.client("sts", region_name="ap-south-1")
        identity = sts.get_caller_identity()
        self.assertIsNotNone(identity, "Failed to retrieve STS identity from current environment.")
        self.assertIn("Arn", identity)

    def test_live_readonly_assume_role(self):
        """Verifies AssumeRole against dedicated customer audit role if provided."""
        if not self.test_role_arn or not self.test_account_id:
            self.skipTest("CLOUDPILOT_TEST_ROLE_ARN or CLOUDPILOT_TEST_ACCOUNT_ID not set.")

        creds = assume_role(
            role_arn=self.test_role_arn,
            expected_account_id=self.test_account_id,
            external_id=self.test_external_id,
            region="ap-south-1"
        )
        self.assertIsNotNone(creds)
        self.assertFalse(creds.get("is_simulated", True))
        self.assertEqual(creds.get("execution_mode"), "live")

    def test_live_readonly_discovery(self):
        """Verifies read-only discovery executes against test account without mutation."""
        if not self.test_role_arn or not self.test_account_id:
            self.skipTest("CLOUDPILOT_TEST_ROLE_ARN or CLOUDPILOT_TEST_ACCOUNT_ID not set.")

        creds = assume_role(
            role_arn=self.test_role_arn,
            expected_account_id=self.test_account_id,
            external_id=self.test_external_id,
            region="ap-south-1"
        )
        findings, total, success_regions, failed_regions, errors = scan_account_live(
            account_id=self.test_account_id,
            region="ap-south-1",
            credentials=creds,
            regions=["ap-south-1"]
        )
        self.assertIsInstance(findings, list)
        self.assertGreaterEqual(total, 0)


if __name__ == "__main__":
    unittest.main()
