import unittest
from unittest.mock import MagicMock, patch
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas import AccountConnectRequest
from app.services.aws_sts import (
    assume_role,
    validate_role_arn,
    STSConfigurationError,
    STSAssumeRoleError,
    STSAccountMismatchError,
    STSValidationError,
    session_cache
)
from app.routers.accounts import connect_account, _connected_accounts

class TestPhase2RealAWSConnection(unittest.TestCase):
    def setUp(self):
        _connected_accounts.clear()
        session_cache.clear()

    # ── Test 1: Successful STS AssumeRole and GetCallerIdentity Verification ───
    def test_successful_sts_and_identity_verification(self):
        with patch("boto3.client") as mock_client:
            # First call is operator STS client, second call is assumed STS client
            operator_sts = MagicMock()
            operator_sts.get_caller_identity.return_value = {
                "Account": "999888777666",
                "Arn": "arn:aws:iam::999888777666:role/CloudPilotOperatorRole"
            }
            exp_time = datetime.now(timezone.utc) + timedelta(hours=1)
            operator_sts.assume_role.return_value = {
                "Credentials": {
                    "AccessKeyId": "ASIAREALTESTKEY123",
                    "SecretAccessKey": "SECRETTESTKEYXYZ",
                    "SessionToken": "SESSIONTOKENXYZ",
                    "Expiration": exp_time
                },
                "AssumedRoleUser": {
                    "Arn": "arn:aws:sts::123456789012:assumed-role/CloudPilotAuditRole/session-123"
                }
            }

            assumed_sts = MagicMock()
            assumed_sts.get_caller_identity.return_value = {
                "Account": "123456789012",
                "Arn": "arn:aws:sts::123456789012:assumed-role/CloudPilotAuditRole/session-123"
            }

            # Return operator_sts on first call, assumed_sts on second call
            mock_client.side_effect = [operator_sts, assumed_sts]

            result = assume_role(
                role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
                external_id="tenant-external-id-1234",
                expected_account_id="123456789012"
            )

            self.assertFalse(result["is_simulated"])
            self.assertEqual(result["execution_mode"], "live")
            self.assertEqual(result["target_account_id"], "123456789012")
            self.assertEqual(result["access_key_id"], "ASIAREALTESTKEY123")
            self.assertIn("verified_at", result)

    # ── Test 2: Account ID mismatch in assumed identity fails ──────────────────
    def test_assumed_identity_account_mismatch_fails(self):
        with patch("boto3.client") as mock_client:
            operator_sts = MagicMock()
            operator_sts.get_caller_identity.return_value = {"Account": "999888777666"}
            exp_time = datetime.now(timezone.utc) + timedelta(hours=1)
            operator_sts.assume_role.return_value = {
                "Credentials": {
                    "AccessKeyId": "ASIAKEY",
                    "SecretAccessKey": "SECRET",
                    "SessionToken": "TOKEN",
                    "Expiration": exp_time
                },
                "AssumedRoleUser": {
                    "Arn": "arn:aws:sts::999999999999:assumed-role/CloudPilotAuditRole/s"
                }
            }
            assumed_sts = MagicMock()
            assumed_sts.get_caller_identity.return_value = {
                "Account": "999999999999"  # WRONG ACCOUNT! Target was 123456789012
            }
            mock_client.side_effect = [operator_sts, assumed_sts]

            with self.assertRaises(STSAccountMismatchError) as ctx:
                assume_role(
                    role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
                    external_id="tenant-external-id-1234",
                    expected_account_id="123456789012"
                )
            self.assertIn("does not match expected target account", str(ctx.exception))

    # ── Test 3: Simulated handshake can NEVER be reported as live ──────────────
    def test_simulated_handshake_never_reported_as_live(self):
        req = AccountConnectRequest(
            account_id="123456789012",
            role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
            external_id="cp-ext-1234",
            mode="demo"
        )
        resp = connect_account(req)
        self.assertFalse(resp.is_live)
        self.assertEqual(resp.execution_mode, "demo")

    # ── Test 4: Sensitive credentials never returned in response ───────────────
    def test_credentials_never_exposed_in_response(self):
        req = AccountConnectRequest(
            account_id="123456789012",
            role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
            external_id="cp-ext-1234",
            mode="demo"
        )
        resp = connect_account(req)
        resp_dict = resp.model_dump()
        self.assertNotIn("secret_access_key", resp_dict)
        self.assertNotIn("session_token", resp_dict)
        self.assertNotIn("access_key_id", resp_dict)

    # ── Test 5: Bounded retry on throttling error ───────────────────────────────
    def test_bounded_retry_on_throttling(self):
        with patch("boto3.client") as mock_client:
            operator_sts = MagicMock()
            operator_sts.get_caller_identity.return_value = {"Account": "999888777666"}
            from botocore.exceptions import ClientError
            operator_sts.assume_role.side_effect = ClientError(
                {"Error": {"Code": "Throttling", "Message": "Rate exceeded"}},
                "AssumeRole"
            )
            mock_client.return_value = operator_sts

            with patch("time.sleep") as mock_sleep:
                with self.assertRaises(STSAssumeRoleError) as ctx:
                    assume_role(
                        role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
                        external_id="tenant-external-id-1234",
                        expected_account_id="123456789012",
                        max_retries=2
                    )
                self.assertIn("Rate exceeded", str(ctx.exception))
                self.assertEqual(mock_sleep.call_count, 2)

if __name__ == "__main__":
    unittest.main()
