"""
Phase 4 Tests: Safe Remediation Engine Vertical Slice
Covers:
- Action Registry schema and parameter validation
- Pre-flight check & Live execution with temporary credentials
- Independent AWS describe verification step
- Failed AWS mutation (ClientError / AccessDenied) - finding remains un-remediated
- Verification failure (mutation called, but resource state unchanged) - finding remains open
- Idempotency key duplicate protection
- Demo vs live approval isolation
"""

import unittest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError

from app.services.remediation import (
    validate_action_parameters,
    execute_live_remediation,
    action_registry,
    _execution_records,
    _idempotency_index
)
from app.routers.discovery import approve_finding, _cached_findings
from app.routers.accounts import _connected_accounts
from app.schemas import (
    FindingModel,
    ResourceModel,
    SafetyCheck,
    ApproveRequest,
    ApproveResponse
)


class TestPhase4RemediationEngine(unittest.TestCase):

    def setUp(self):
        _execution_records.clear()
        _idempotency_index.clear()
        _cached_findings.clear()
        _connected_accounts.clear()

    # ── Test 1: Action Registry Parameter Validation ──────────────────────────
    def test_parameter_validation_success(self):
        # Must not raise an exception
        validate_action_parameters(
            "ec2:RevokeSecurityGroupIngress",
            "sg-0123456789abcdef0",
            {
                "GroupId": "sg-0123456789abcdef0",
                "CidrIp": "0.0.0.0/0",
                "FromPort": 22,
                "ToPort": 22,
                "IpProtocol": "tcp"
            }
        )

    def test_parameter_validation_rejects_unsupported_action(self):
        with self.assertRaises(ValueError) as ctx:
            validate_action_parameters("s3:DeleteAllBuckets", "bucket-1", {})
        self.assertIn("not registered", str(ctx.exception))

    def test_parameter_validation_rejects_invalid_sg_id(self):
        with self.assertRaises(ValueError) as ctx:
            validate_action_parameters(
                "ec2:RevokeSecurityGroupIngress",
                "invalid-sg-id",
                {"CidrIp": "0.0.0.0/0", "FromPort": 22, "ToPort": 22}
            )
        self.assertIn("Invalid Security Group ID", str(ctx.exception))

    def test_parameter_validation_rejects_non_ssh_port(self):
        with self.assertRaises(ValueError) as ctx:
            validate_action_parameters(
                "ec2:RevokeSecurityGroupIngress",
                "sg-0123456789abcdef0",
                {"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": 80, "ToPort": 80}
            )
        self.assertIn("Port range must be exact port 22", str(ctx.exception))

    def test_parameter_validation_rejects_non_wildcard_cidr(self):
        with self.assertRaises(ValueError) as ctx:
            validate_action_parameters(
                "ec2:RevokeSecurityGroupIngress",
                "sg-0123456789abcdef0",
                {"GroupId": "sg-0123456789abcdef0", "CidrIp": "192.168.1.0/24", "FromPort": 22, "ToPort": 22}
            )
        self.assertIn("CidrIp must be exactly '0.0.0.0/0'", str(ctx.exception))

    # ── Test 2: Successful Live Execution & Verification ───────────────────────
    def test_live_remediation_success_and_independent_verification(self):
        mock_ec2 = MagicMock()
        # Pre-flight describe: rule is currently present
        mock_ec2.describe_security_groups.side_effect = [
            {
                "SecurityGroups": [{
                    "GroupId": "sg-0123456789abcdef0",
                    "IpPermissions": [{
                        "IpProtocol": "tcp",
                        "FromPort": 22,
                        "ToPort": 22,
                        "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
                    }]
                }]
            },
            # Post-execution verification describe: rule is ABSENT
            {
                "SecurityGroups": [{
                    "GroupId": "sg-0123456789abcdef0",
                    "IpPermissions": []
                }]
            }
        ]
        mock_ec2.revoke_security_group_ingress.return_value = {
            "ResponseMetadata": {"RequestId": "aws-req-rev-123", "HTTPStatusCode": 200}
        }

        live_creds = {
            "access_key_id": "AKIALIVE",
            "secret_access_key": "secret",
            "session_token": "token",
            "is_simulated": False,
            "execution_mode": "live"
        }

        with patch("app.services.aws_sts.get_ec2_client", return_value=mock_ec2):
            record = execute_live_remediation(
                account_id="123456789012",
                region="ap-south-1",
                resource_id="sg-0123456789abcdef0",
                action_type="ec2:RevokeSecurityGroupIngress",
                parameters={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": 22, "ToPort": 22},
                actor_email="alice@cloudpilot.io",
                finding_id="find-sec-1",
                credentials=live_creds,
                idempotency_key="idemp-key-1",
                mode="live"
            )

        self.assertEqual(record.state, "succeeded")
        self.assertEqual(record.aws_request_id, "aws-req-rev-123")
        self.assertIn("REVOKED (VERIFIED ✓)", record.after_state)
        self.assertIsNotNone(record.verified_at)

        # Confirm AWS EC2 calls
        mock_ec2.revoke_security_group_ingress.assert_called_once_with(
            GroupId="sg-0123456789abcdef0",
            IpProtocol="tcp",
            FromPort=22,
            ToPort=22,
            CidrIp="0.0.0.0/0"
        )
        self.assertEqual(mock_ec2.describe_security_groups.call_count, 2)

    # ── Test 3: Failed AWS Mutation (AccessDenied / ClientError) ───────────────
    def test_live_remediation_aws_denied(self):
        mock_ec2 = MagicMock()
        mock_ec2.describe_security_groups.return_value = {
            "SecurityGroups": [{
                "GroupId": "sg-0123456789abcdef0",
                "IpPermissions": [{
                    "IpProtocol": "tcp",
                    "FromPort": 22,
                    "ToPort": 22,
                    "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
                }]
            }]
        }
        mock_ec2.revoke_security_group_ingress.side_effect = ClientError(
            {"Error": {"Code": "UnauthorizedOperation", "Message": "You are not authorized to perform this operation."}},
            "RevokeSecurityGroupIngress"
        )

        with patch("app.services.aws_sts.get_ec2_client", return_value=mock_ec2):
            record = execute_live_remediation(
                account_id="123456789012",
                region="ap-south-1",
                resource_id="sg-0123456789abcdef0",
                action_type="ec2:RevokeSecurityGroupIngress",
                parameters={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": 22, "ToPort": 22},
                actor_email="alice@cloudpilot.io",
                finding_id="find-sec-2",
                credentials={"access_key_id": "k", "secret_access_key": "s", "session_token": "t"},
                idempotency_key="idemp-key-2",
                mode="live"
            )

        self.assertEqual(record.state, "failed")
        self.assertIn("UnauthorizedOperation", record.error_message)

    # ── Test 4: Verification Failure (AWS returned 200 but rule still active) ──
    def test_live_remediation_verification_failed_rule_still_present(self):
        mock_ec2 = MagicMock()
        # Both pre-flight and post-execution describe show rule is STILL PRESENT
        mock_ec2.describe_security_groups.return_value = {
            "SecurityGroups": [{
                "GroupId": "sg-0123456789abcdef0",
                "IpPermissions": [{
                    "IpProtocol": "tcp",
                    "FromPort": 22,
                    "ToPort": 22,
                    "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
                }]
            }]
        }
        mock_ec2.revoke_security_group_ingress.return_value = {
            "ResponseMetadata": {"RequestId": "aws-req-rev-789", "HTTPStatusCode": 200}
        }

        with patch("app.services.aws_sts.get_ec2_client", return_value=mock_ec2):
            record = execute_live_remediation(
                account_id="123456789012",
                region="ap-south-1",
                resource_id="sg-0123456789abcdef0",
                action_type="ec2:RevokeSecurityGroupIngress",
                parameters={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": 22, "ToPort": 22},
                actor_email="alice@cloudpilot.io",
                finding_id="find-sec-3",
                credentials={"access_key_id": "k", "secret_access_key": "s", "session_token": "t"},
                idempotency_key="idemp-key-3",
                mode="live"
            )

        self.assertEqual(record.state, "verification_failed")
        self.assertIn("still present after revoke call", record.error_message)

    # ── Test 5: Idempotency Duplicate Execution Protection ────────────────────
    def test_idempotency_duplicate_protection(self):
        mock_ec2 = MagicMock()
        mock_ec2.describe_security_groups.side_effect = [
            {"SecurityGroups": [{"GroupId": "sg-0123456789abcdef0", "IpPermissions": [{"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}]}]},
            {"SecurityGroups": [{"GroupId": "sg-0123456789abcdef0", "IpPermissions": []}]}
        ]
        mock_ec2.revoke_security_group_ingress.return_value = {
            "ResponseMetadata": {"RequestId": "aws-req-rev-unique", "HTTPStatusCode": 200}
        }

        with patch("app.services.aws_sts.get_ec2_client", return_value=mock_ec2):
            record1 = execute_live_remediation(
                account_id="123456789012",
                region="ap-south-1",
                resource_id="sg-0123456789abcdef0",
                action_type="ec2:RevokeSecurityGroupIngress",
                parameters={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": 22, "ToPort": 22},
                actor_email="alice@cloudpilot.io",
                finding_id="find-sec-idem",
                credentials={"access_key_id": "k", "secret_access_key": "s", "session_token": "t"},
                idempotency_key="idemp-unique-123",
                mode="live"
            )
            self.assertEqual(record1.state, "succeeded")
            self.assertEqual(mock_ec2.revoke_security_group_ingress.call_count, 1)

            # Duplicate call with identical idempotency key
            record2 = execute_live_remediation(
                account_id="123456789012",
                region="ap-south-1",
                resource_id="sg-0123456789abcdef0",
                action_type="ec2:RevokeSecurityGroupIngress",
                parameters={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": 22, "ToPort": 22},
                actor_email="alice@cloudpilot.io",
                finding_id="find-sec-idem",
                credentials={"access_key_id": "k", "secret_access_key": "s", "session_token": "t"},
                idempotency_key="idemp-unique-123",
                mode="live"
            )
            # Must return the existing record and NOT invoke AWS revoke again
            self.assertEqual(record2.execution_id, record1.execution_id)
            self.assertEqual(mock_ec2.revoke_security_group_ingress.call_count, 1)

    # ── Test 6: Demo vs Live Approval Endpoint Behavior ───────────────────────
    def test_demo_approval_is_explicitly_simulated(self):
        # Seed demo finding
        finding = FindingModel(
            id="demo-find-101",
            category="security",
            severity="critical",
            title="Demo SSH Open",
            description="Demo SSH open",
            rule="SEC-SG-001",
            resource=ResourceModel(id="sg-demo-01", type="AWS::EC2::SecurityGroup", name="demo-sg", region="ap-south-1", age="1d"),
            evidence=["Simulated rule TCP:22 from 0.0.0.0/0 present"],
            status="open",
            detectedAt="2026-10-22T00:00:00Z",
            affectedService="Amazon VPC",
            recommendedAction="Revoke",
            operation="ec2:RevokeSecurityGroupIngress",
            operationParams={"GroupId": "sg-demo-01", "CidrIp": "0.0.0.0/0", "FromPort": "22", "ToPort": "22"},
            preconditions=[],
            sideEffects=[],
            verificationPlan=[],
            recoveryGuidance=[],
            recoveryLimitations="",
            beforeState="TCP:22 OPEN",
            afterState="TCP:22 CLOSED",
            telemetryMetricName="Probes",
            telemetryUnit="Probes/hr",
            telemetryData=[],
            execution_mode="demo"
        )
        _cached_findings["demo:demo-find-101"] = finding

        req = ApproveRequest(user_email="demo@cloudpilot.io", mode="demo")
        res = approve_finding("demo-find-101", req)

        self.assertTrue(res.success)
        self.assertEqual(res.execution_mode, "demo")
        self.assertEqual(res.verification_status, "verified")
        self.assertIn("demo-req-", res.aws_request_id)
        # Finding in demo cache is marked resolved
        self.assertEqual(_cached_findings["demo:demo-find-101"].status, "resolved")

    def test_live_approval_fails_without_connected_account(self):
        finding = FindingModel(
            id="live-find-202",
            category="security",
            severity="critical",
            title="Live SSH Open",
            description="Live SSH open",
            rule="SEC-SG-001",
            resource=ResourceModel(id="sg-0123456789abcdef0", type="AWS::EC2::SecurityGroup", name="prod-sg", region="ap-south-1", age="10d", account_id="999888777666"),
            evidence=["Verified rule TCP:22 from 0.0.0.0/0 via describe_security_groups"],
            status="open",
            detectedAt="2026-10-22T00:00:00Z",
            affectedService="Amazon VPC",
            recommendedAction="Revoke",
            operation="ec2:RevokeSecurityGroupIngress",
            operationParams={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": "22", "ToPort": "22"},
            preconditions=[],
            sideEffects=[],
            verificationPlan=[],
            recoveryGuidance=[],
            recoveryLimitations="",
            beforeState="TCP:22 OPEN",
            afterState="TCP:22 CLOSED",
            telemetryMetricName="Probes",
            telemetryUnit="Probes/hr",
            telemetryData=[],
            execution_mode="live"
        )
        _cached_findings["live:live-find-202"] = finding

        req = ApproveRequest(user_email="alice@cloudpilot.io", mode="live")
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as ctx:
            approve_finding("live-find-202", req)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Target AWS account for sg-0123456789abcdef0 is not connected", ctx.exception.detail)
        # Finding must NOT be marked resolved!
        self.assertEqual(_cached_findings["live:live-find-202"].status, "open")


if __name__ == "__main__":
    unittest.main()
