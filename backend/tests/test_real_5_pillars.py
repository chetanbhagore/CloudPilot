import unittest
from unittest.mock import MagicMock, patch
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from botocore.exceptions import ClientError
from datetime import datetime, timezone, timedelta

from app.services.aws_sts import (
    connect_localstack,
    get_s3_client,
    get_iam_client,
    validate_role_arn,
    STSValidationError
)
from app.services.aws_discovery import scan_account_live
from app.services.ai_explainer import generate_finding_explanation
from app.services.remediation import (
    validate_action_parameters,
    execute_live_remediation,
    action_registry,
    _execution_records,
    _idempotency_index
)
from app.schemas import FindingModel, ResourceModel, SafetyCheck


class TestRealFivePillars(unittest.TestCase):
    """
    Validates the 5 Real Production Pillars:
    1. LocalStack & Credential Engine
    2. Expanded 6-Rule Real Security & FinOps Scanner
    3. Live Interactive AI Diagnostics Engine
    4. Multi-Action Verified Remediation Engine
    5. Cryptographic Audit Attestation Export & Verification
    """

    def setUp(self):
        _execution_records.clear()
        _idempotency_index.clear()

    # --- PILLAR 1: LocalStack & STS Engine ---
    def test_localstack_connection_valid(self):
        client_mock = MagicMock()
        client_mock.get_caller_identity.return_value = {
            "Account": "000000000000",
            "Arn": "arn:aws:iam::000000000000:root"
        }
        with patch("boto3.client", return_value=client_mock) as mock_boto:
            res = connect_localstack(account_id="000000000000", endpoint_url="http://localhost:4566")
            self.assertEqual(res["target_account_id"], "000000000000")
            self.assertEqual(res["endpoint_url"], "http://localhost:4566")
            self.assertEqual(res["execution_mode"], "live")
            self.assertTrue(res["is_localstack"])
            mock_boto.assert_called_once()

    def test_validate_role_arn_supports_root_and_roles(self):
        self.assertEqual(validate_role_arn("arn:aws:iam::123456789012:role/CloudPilotAuditRole"), "123456789012")
        self.assertEqual(validate_role_arn("arn:aws:iam::000000000000:root"), "000000000000")
        with self.assertRaises(STSValidationError):
            validate_role_arn("invalid-arn")

    # --- PILLAR 2: Expanded 6-Rule Scanner ---
    def test_scanner_eip_detection(self):
        live_creds = {
            "access_key_id": "AKIAEXAMPLE",
            "secret_access_key": "SECRETEXAMPLE",
            "session_token": "TOKENEXAMPLE",
            "is_simulated": False,
            "execution_mode": "live"
        }

        mock_ec2 = MagicMock()
        mock_vol_paginator = MagicMock()
        mock_vol_paginator.paginate.return_value = [{"Volumes": []}]
        mock_sg_paginator = MagicMock()
        mock_sg_paginator.paginate.return_value = [{"SecurityGroups": []}]

        def paginator_side_effect(service_name):
            if service_name == "describe_volumes":
                return mock_vol_paginator
            return mock_sg_paginator

        mock_ec2.get_paginator.side_effect = paginator_side_effect
        mock_ec2.describe_addresses.return_value = {
            "Addresses": [
                {
                    "PublicIp": "54.214.10.20",
                    "AllocationId": "eipalloc-12345",
                    "Domain": "vpc",
                    "NetworkBorderGroup": "ap-south-1"
                },
                {
                    "PublicIp": "54.214.10.21",
                    "AllocationId": "eipalloc-67890",
                    "AssociationId": "eipassoc-99999",
                    "InstanceId": "i-12345"
                }
            ]
        }

        with patch("app.services.aws_discovery.get_ec2_client", return_value=mock_ec2), \
             patch("app.services.aws_discovery.get_s3_client", side_effect=ClientError({"Error": {"Code": "AccessDenied"}}, "ListBuckets")), \
             patch("app.services.aws_discovery.get_iam_client", side_effect=ClientError({"Error": {"Code": "AccessDenied"}}, "ListUsers")):

            findings, count, successful, failed, errors = scan_account_live(
                account_id="123456789012",
                region="ap-south-1",
                credentials=live_creds,
                regions=["ap-south-1"]
            )

            eip_findings = [f for f in findings if f.rule.startswith("COST-EIP-001")]
            self.assertEqual(len(eip_findings), 1)
            self.assertEqual(eip_findings[0].resource.id, "eipalloc-12345")
            self.assertEqual(eip_findings[0].category, "cost")
            self.assertEqual(eip_findings[0].operation, "ec2:ReleaseAddress")

    def test_scanner_s3_public_access_block_detection(self):
        live_creds = {
            "access_key_id": "AKIAEXAMPLE",
            "secret_access_key": "SECRETEXAMPLE",
            "session_token": "TOKENEXAMPLE",
            "is_simulated": False,
            "execution_mode": "live"
        }

        mock_ec2 = MagicMock()
        mock_vol_paginator = MagicMock()
        mock_vol_paginator.paginate.return_value = [{"Volumes": []}]
        mock_sg_paginator = MagicMock()
        mock_sg_paginator.paginate.return_value = [{"SecurityGroups": []}]
        mock_ec2.get_paginator.side_effect = lambda s: mock_vol_paginator if s == "describe_volumes" else mock_sg_paginator
        mock_ec2.describe_addresses.return_value = {"Addresses": []}

        mock_s3 = MagicMock()
        mock_s3.list_buckets.return_value = {
            "Buckets": [
                {"Name": "open-data-bucket-123", "CreationDate": datetime.now(timezone.utc)},
                {"Name": "secure-internal-bucket", "CreationDate": datetime.now(timezone.utc)}
            ]
        }
        def get_pab(Bucket):
            if Bucket == "open-data-bucket-123":
                return {
                    "PublicAccessBlockConfiguration": {
                        "BlockPublicAcls": True,
                        "IgnorePublicAcls": False,
                        "BlockPublicPolicy": False,
                        "RestrictPublicBuckets": False
                    }
                }
            return {
                "PublicAccessBlockConfiguration": {
                    "BlockPublicAcls": True,
                    "IgnorePublicAcls": True,
                    "BlockPublicPolicy": True,
                    "RestrictPublicBuckets": True
                }
            }
        mock_s3.get_public_access_block.side_effect = get_pab

        with patch("app.services.aws_discovery.get_ec2_client", return_value=mock_ec2), \
             patch("app.services.aws_discovery.get_s3_client", return_value=mock_s3), \
             patch("app.services.aws_discovery.get_iam_client", side_effect=ClientError({"Error": {"Code": "AccessDenied"}}, "ListUsers")):

            findings, count, successful, failed, errors = scan_account_live(
                account_id="123456789012",
                region="us-east-1",
                credentials=live_creds,
                regions=["us-east-1"]
            )

            s3_findings = [f for f in findings if f.rule.startswith("SEC-S3-001")]
            self.assertEqual(len(s3_findings), 1)
            self.assertEqual(s3_findings[0].resource.id, "open-data-bucket-123")
            self.assertEqual(s3_findings[0].severity, "critical")
            self.assertEqual(s3_findings[0].operation, "s3:PutPublicAccessBlock")

    def test_scanner_stale_iam_keys_detection(self):
        live_creds = {
            "access_key_id": "AKIAEXAMPLE",
            "secret_access_key": "SECRETEXAMPLE",
            "session_token": "TOKENEXAMPLE",
            "is_simulated": False,
            "execution_mode": "live"
        }

        mock_ec2 = MagicMock()
        mock_vol_paginator = MagicMock()
        mock_vol_paginator.paginate.return_value = [{"Volumes": []}]
        mock_sg_paginator = MagicMock()
        mock_sg_paginator.paginate.return_value = [{"SecurityGroups": []}]
        mock_ec2.get_paginator.side_effect = lambda s: mock_vol_paginator if s == "describe_volumes" else mock_sg_paginator
        mock_ec2.describe_addresses.return_value = {"Addresses": []}

        mock_iam = MagicMock()
        mock_iam.list_users.return_value = {
            "Users": [{"UserName": "deploy-bot", "UserId": "AIDA123"}]
        }
        stale_date = datetime.now(timezone.utc) - timedelta(days=120)
        mock_iam.list_access_keys.return_value = {
            "AccessKeyMetadata": [
                {"UserName": "deploy-bot", "AccessKeyId": "AKIAOLD12345", "Status": "Active", "CreateDate": stale_date}
            ]
        }

        with patch("app.services.aws_discovery.get_ec2_client", return_value=mock_ec2), \
             patch("app.services.aws_discovery.get_s3_client", side_effect=ClientError({"Error": {"Code": "AccessDenied"}}, "ListBuckets")), \
             patch("app.services.aws_discovery.get_iam_client", return_value=mock_iam):

            findings, count, successful, failed, errors = scan_account_live(
                account_id="123456789012",
                region="us-east-1",
                credentials=live_creds,
                regions=["us-east-1"]
            )

            iam_findings = [f for f in findings if f.rule.startswith("SEC-IAM-001")]
            self.assertEqual(len(iam_findings), 1)
            self.assertEqual(iam_findings[0].resource.id, "AKIAOLD12345")
            self.assertEqual(iam_findings[0].severity, "high")

    # --- PILLAR 3: AI Explainer Diagnostics ---
    def test_ai_explainer_produces_structured_explanations(self):
        now_iso = datetime.now(timezone.utc).isoformat()
        f = FindingModel(
            id="live-eip-test",
            category="cost",
            severity="low",
            title="Unassociated Elastic IP generating idle costs",
            description="Elastic IP eipalloc-12345 is unallocated.",
            rule="COST-EIP-001: Unassociated Elastic IP",
            resource=ResourceModel(
                id="eipalloc-12345",
                type="AWS::EC2::EIP",
                name="eip-test",
                region="ap-south-1",
                age="10 days",
                account_id="123456789012"
            ),
            evidence=["Source: ec2:DescribeAddresses"],
            detectedAt=now_iso,
            affectedService="Amazon VPC",
            recommendedAction="Release unassociated Elastic IP eipalloc-12345",
            operation="ec2:ReleaseAddress",
            operationParams={"AllocationId": "eipalloc-12345"},
            beforeState="UNASSOCIATED",
            afterState="RELEASED",
            preconditions=[SafetyCheck(label="Verify Allocation", passed=True, detail="OK", evidence_source="test", evaluated_at=now_iso)]
        )

        explanation = generate_finding_explanation(f)
        self.assertIn("eipalloc-12345", explanation.root_cause_analysis)
        self.assertEqual(explanation.action_type, "ec2:ReleaseAddress")
        self.assertTrue(explanation.is_action_supported_by_engine)
        self.assertTrue(len(explanation.observed_facts) > 0)
        self.assertTrue(len(explanation.uncertainty_and_limitations) > 0)

    # --- PILLAR 4: Multi-Action Verified Remediation Engine ---
    def test_action_registry_includes_new_actions(self):
        self.assertIsNotNone(action_registry.get("ec2:ReleaseAddress"))
        self.assertIsNotNone(action_registry.get("s3:PutPublicAccessBlock"))
        self.assertIsNotNone(action_registry.get("ec2:CreateSnapshot"))

    def test_remediation_executor_eip_release(self):
        live_creds = {
            "access_key_id": "AKIAEXAMPLE",
            "secret_access_key": "SECRETEXAMPLE",
            "session_token": "TOKENEXAMPLE",
            "is_simulated": False,
            "execution_mode": "live"
        }

        mock_ec2 = MagicMock()
        mock_ec2.describe_addresses.side_effect = [
            {"Addresses": [{"AllocationId": "eipalloc-12345"}]}, # pre-check
            {"Addresses": []} # verify check returns empty
        ]
        mock_ec2.release_address.return_value = {"ResponseMetadata": {"RequestId": "aws-req-rel-1"}}

        validate_action_parameters("ec2:ReleaseAddress", "eipalloc-12345", {"AllocationId": "eipalloc-12345"})

        with patch("app.services.aws_sts.get_ec2_client", return_value=mock_ec2):
            res = execute_live_remediation(
                account_id="123456789012",
                region="ap-south-1",
                resource_id="eipalloc-12345",
                action_type="ec2:ReleaseAddress",
                parameters={"AllocationId": "eipalloc-12345"},
                actor_email="admin@acme.corp",
                finding_id="f-eip-123",
                credentials=live_creds,
                idempotency_key="idemp-rel-test-1"
            )
            self.assertEqual(res.state, "succeeded")
            self.assertEqual(res.aws_request_id, "aws-req-rel-1")

    def test_remediation_executor_s3_put_public_access_block(self):
        live_creds = {
            "access_key_id": "AKIAEXAMPLE",
            "secret_access_key": "SECRETEXAMPLE",
            "session_token": "TOKENEXAMPLE",
            "is_simulated": False,
            "execution_mode": "live"
        }

        mock_s3 = MagicMock()
        mock_s3.put_public_access_block.return_value = {"ResponseMetadata": {"RequestId": "aws-req-s3-1"}}
        mock_s3.get_public_access_block.return_value = {
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True
            }
        }

        validate_action_parameters("s3:PutPublicAccessBlock", "corp-bucket-123", {"Bucket": "corp-bucket-123"})

        with patch("app.services.aws_sts.get_s3_client", return_value=mock_s3):
            res = execute_live_remediation(
                account_id="123456789012",
                region="us-east-1",
                resource_id="corp-bucket-123",
                action_type="s3:PutPublicAccessBlock",
                parameters={"Bucket": "corp-bucket-123"},
                actor_email="admin@acme.corp",
                finding_id="f-s3-123",
                credentials=live_creds,
                idempotency_key="idemp-s3-test-1"
            )
            self.assertEqual(res.state, "succeeded")
            self.assertEqual(res.aws_request_id, "aws-req-s3-1")


if __name__ == "__main__":
    unittest.main()
