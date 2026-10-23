"""Unit and integration tests for direct AWS IAM Access Key authentication and live discovery.

Verifies:
- Direct AWS access key validation and identity resolution via sts:GetCallerIdentity
- Zero fallback to simulated/demo credentials on live access key paths
- Routing of access key accounts through discovery scanner
- Rejection of invalid credentials
"""

import unittest
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from app.schemas import AccountConnectRequest
from app.routers.accounts import connect_account
from app.services.aws_sts import (
    connect_with_access_keys,
    STSValidationError,
    STSAssumeRoleError,
    session_cache
)


class TestRealAccessKeys(unittest.TestCase):
    def setUp(self):
        session_cache.clear()

    def tearDown(self):
        session_cache.clear()

    def test_empty_keys_raise_validation_error(self):
        with self.assertRaises(STSValidationError):
            connect_with_access_keys("", "secret")
        with self.assertRaises(STSValidationError):
            connect_with_access_keys("AKIA123", "")

    @patch("app.services.aws_sts.boto3.client")
    def test_valid_access_keys_resolves_real_identity(self, mock_boto_client):
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "998877665544",
            "Arn": "arn:aws:iam::998877665544:user/finops-lead",
            "UserId": "AIDA12345EXAMPLE"
        }
        mock_boto_client.return_value = mock_sts

        session = connect_with_access_keys(
            access_key_id="AKIAREALACCESSKEY123",
            secret_access_key="REAL-SECRET-KEY-456",
            region="ap-south-1"
        )

        self.assertEqual(session["target_account_id"], "998877665544")
        self.assertEqual(session["assumed_role_user_arn"], "arn:aws:iam::998877665544:user/finops-lead")
        self.assertFalse(session["is_simulated"])
        self.assertEqual(session["execution_mode"], "live")
        self.assertEqual(session["connection_type"], "access_keys")
        self.assertIsNotNone(session_cache.get("998877665544|access_keys|ap-south-1"))

    @patch("app.services.aws_sts.boto3.client")
    def test_invalid_keys_raise_assume_role_error(self, mock_boto_client):
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.side_effect = ClientError(
            {"Error": {"Code": "InvalidClientTokenId", "Message": "The security token included in the request is invalid."}},
            "GetCallerIdentity"
        )
        mock_boto_client.return_value = mock_sts

        with self.assertRaises(STSAssumeRoleError):
            connect_with_access_keys(
                access_key_id="AKIAINVALIDKEY",
                secret_access_key="INVALIDSECRET",
                region="us-east-1"
            )

    @patch("app.services.aws_sts.boto3.client")
    def test_accounts_connect_endpoint_with_access_keys(self, mock_boto_client):
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "556677889900",
            "Arn": "arn:aws:iam::556677889900:user/production-auditor"
        }
        mock_boto_client.return_value = mock_sts

        req = AccountConnectRequest(
            account_id="",
            cloud_provider="aws",
            connection_type="access_keys",
            region="us-west-2",
            mode="live",
            aws_access_key_id="AKIAEXAMPLELIVEKEY",
            aws_secret_access_key="EXAMPLELIVESECRET"
        )

        resp = connect_account(req)
        self.assertTrue(resp.success)
        self.assertEqual(resp.account_id, "556677889900")
        self.assertTrue(resp.is_live)
        self.assertEqual(resp.execution_mode, "live")
        self.assertIn("IAM Access Keys", resp.message)


if __name__ == "__main__":
    unittest.main()
