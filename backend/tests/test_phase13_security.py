"""
Phase 13: Security Verification & Adversarial Test Suite
Non-negotiable Rules:
- Unauthenticated requests to protected endpoints fail closed with 401 Unauthorized.
- Role escalation attempts fail closed with 403 Forbidden.
- Cross-tenant IDOR attacks fail closed with 403 Forbidden; queries strictly scoped by org_id.
- Replay and duplicate mutations are blocked by idempotency keys.
- Stale, expired, or parameter-mutated Safety Passports are rejected.
- Verification failure never marks a finding resolved.
- Cryptographic hash-chain tampering in audit ledger is immediately detected.
"""

import unittest
import sys
import os
import time
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.auth import (
    get_current_user,
    require_permission,
    enforce_tenant_isolation,
    create_access_token,
    ROLE_PERMISSIONS,
    AuthenticatedUser
)
from app.services.safety_passport import (
    build_safety_passport,
    revalidate_safety_passport_before_execution,
    compute_canonical_param_hash,
    SafetyPassportModel
)
from app.services.remediation import (
    execute_live_remediation,
    _execution_records,
    _idempotency_index
)
from app.db.database import (
    init_database_schema,
    AccountRepository,
    FindingRepository,
    AuditRepository,
    get_db_connection,
    get_db_transaction
)
from app.schemas import FindingModel, ResourceModel


class TestPhase13SecurityVerification(unittest.TestCase):
    def setUp(self):
        init_database_schema()
        _execution_records.clear()
        _idempotency_index.clear()

    # ── 1. Unauthenticated Requests Fail Closed (401) ────────────────────────
    def test_unauthenticated_live_request_rejected(self):
        """Live mode without authorization header is rejected with 401 Unauthorized."""
        with self.assertRaises(HTTPException) as ctx:
            get_current_user(authorization=None, mode="live")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Authentication required", ctx.exception.detail)

    def test_malformed_authorization_scheme_rejected(self):
        """Malformed or non-Bearer authorization scheme is rejected with 401."""
        invalid_schemes = [
            "Basic dXNlcjpwYXNz",
            "Token 123456",
            "BearerOnlyOnePart",
            "Bearer part1.part2.part3"
        ]
        for scheme in invalid_schemes:
            with self.subTest(scheme=scheme):
                with self.assertRaises(HTTPException) as ctx:
                    get_current_user(authorization=scheme, mode="live")
                self.assertEqual(ctx.exception.status_code, 401)

    def test_tampered_token_signature_rejected(self):
        """Altered JWT token signature fails closed with 401 Unauthorized."""
        user = {
            "id": "usr-test-01",
            "email": "test@acmecloud.io",
            "org_id": "org-acme-prod",
            "role": "DevOpsLead"
        }
        token, _ = create_access_token(user)
        # Tamper with the token signature
        payload_b64, sig = token.split(".")
        tampered_sig = "a" * len(sig)
        tampered_token = f"Bearer {payload_b64}.{tampered_sig}"

        with self.assertRaises(HTTPException) as ctx:
            get_current_user(authorization=tampered_token, mode="live")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Invalid token signature", ctx.exception.detail)

    # ── 2. Role Escalation Attacks Blocked (403) ─────────────────────────────
    def test_viewer_role_escalation_blocked(self):
        """Viewer role attempting to invoke remediation is rejected with 403."""
        viewer = AuthenticatedUser(
            user_id="usr-viewer-01",
            email="viewer@acmecloud.io",
            organization_id="org-acme-prod",
            role="Viewer",
            permissions=ROLE_PERMISSIONS["Viewer"]
        )
        approve_checker = require_permission("approve:remediation")
        with self.assertRaises(HTTPException) as ctx:
            approve_checker(current_user=viewer)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Forbidden", ctx.exception.detail)

        exec_checker = require_permission("execute:remediation")
        with self.assertRaises(HTTPException) as ctx:
            exec_checker(current_user=viewer)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_analyst_role_escalation_blocked(self):
        """Security Analyst role attempting to execute write mutation is rejected with 403."""
        analyst = AuthenticatedUser(
            user_id="usr-analyst-01",
            email="analyst@acmecloud.io",
            organization_id="org-acme-prod",
            role="SecurityAnalyst",
            permissions=ROLE_PERMISSIONS["SecurityAnalyst"]
        )
        exec_checker = require_permission("execute:remediation")
        with self.assertRaises(HTTPException) as ctx:
            exec_checker(current_user=analyst)
        self.assertEqual(ctx.exception.status_code, 403)

    # ── 3. Cross-Tenant IDOR Attacks Blocked (403 & Scoped DB) ───────────────
    def test_cross_tenant_access_rejected_by_policy(self):
        """User from Org B attempting to access resource in Org A is rejected with 403."""
        evil_user = AuthenticatedUser(
            user_id="usr-evil-01",
            email="attacker@evilcorp.io",
            organization_id="org-evil-tenant",
            role="Admin",
            permissions=ROLE_PERMISSIONS["Admin"]
        )
        with self.assertRaises(HTTPException) as ctx:
            enforce_tenant_isolation(resource_org_id="org-acme-prod", current_user=evil_user)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Forbidden", ctx.exception.detail)

    def test_tenant_database_isolation(self):
        """Database queries strictly scope records by tenant org_id; no data leakage."""
        # Ensure orgs exist
        with get_db_transaction() as conn:
            conn.execute("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES ('org-acme-prod', 'Acme Prod', datetime('now'))")
            conn.execute("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES ('org-evil-tenant', 'Evil Tenant', datetime('now'))")
            conn.execute("DELETE FROM aws_accounts WHERE organization_id IN ('org-acme-prod', 'org-evil-tenant')")

        # Save account for Org A
        AccountRepository.save_account(
            org_id="org-acme-prod",
            account_data={
                "account_id": "111122223333",
                "alias": "Acme-Prod-AWS",
                "role_arn": "arn:aws:iam::111122223333:role/CloudPilotAuditRole",
                "external_id": "ext-acme-secret",
                "region": "ap-south-1",
                "connection_status": "connected",
                "execution_mode": "live",
                "connected_at": "2026-10-23T01:00:00Z"
            }
        )

        # Save account for Org B
        AccountRepository.save_account(
            org_id="org-evil-tenant",
            account_data={
                "account_id": "999988887777",
                "alias": "EvilCorp-AWS",
                "role_arn": "arn:aws:iam::999988887777:role/CloudPilotAuditRole",
                "external_id": "ext-evil-secret",
                "region": "us-east-1",
                "connection_status": "connected",
                "execution_mode": "live",
                "connected_at": "2026-10-23T01:00:00Z"
            }
        )

        # Query Org A
        acme_accounts = AccountRepository.get_accounts("org-acme-prod", mode="live")
        acme_ids = [a["account_id"] for a in acme_accounts]
        self.assertIn("111122223333", acme_ids)
        self.assertNotIn("999988887777", acme_ids)

        # Query Org B
        evil_accounts = AccountRepository.get_accounts("org-evil-tenant", mode="live")
        evil_ids = [a["account_id"] for a in evil_accounts]
        self.assertIn("999988887777", evil_ids)
        self.assertNotIn("111122223333", evil_ids)

    # ── 4. Duplicate Execution & Idempotency Replay Protection ────────────────
    def test_idempotent_replay_protection(self):
        """Replaying a mutation with the same idempotency key returns existing record without invoking AWS."""
        mock_ec2 = MagicMock()
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
            {
                "SecurityGroups": [{
                    "GroupId": "sg-0123456789abcdef0",
                    "IpPermissions": []
                }]
            }
        ]
        mock_ec2.revoke_security_group_ingress.return_value = {
            "ResponseMetadata": {"RequestId": "aws-req-unique-999"}
        }

        live_creds = {
            "access_key_id": "AKIALIVE",
            "secret_access_key": "secret",
            "session_token": "token",
            "is_simulated": False,
            "execution_mode": "live"
        }

        with patch("app.services.aws_sts.get_ec2_client", return_value=mock_ec2):
            # 1st Execution
            rec1 = execute_live_remediation(
                account_id="123456789012",
                region="ap-south-1",
                resource_id="sg-0123456789abcdef0",
                action_type="ec2:RevokeSecurityGroupIngress",
                parameters={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": 22, "ToPort": 22},
                actor_email="devops@acmecloud.io",
                finding_id="find-idemp-01",
                credentials=live_creds,
                idempotency_key="idemp-strict-replay-key-001",
                mode="live"
            )
            self.assertEqual(rec1.state, "succeeded")
            self.assertEqual(mock_ec2.revoke_security_group_ingress.call_count, 1)

            # 2nd Execution: Replay attempt with same idempotency key
            rec2 = execute_live_remediation(
                account_id="123456789012",
                region="ap-south-1",
                resource_id="sg-0123456789abcdef0",
                action_type="ec2:RevokeSecurityGroupIngress",
                parameters={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": 22, "ToPort": 22},
                actor_email="devops@acmecloud.io",
                finding_id="find-idemp-01",
                credentials=live_creds,
                idempotency_key="idemp-strict-replay-key-001",
                mode="live"
            )
            self.assertEqual(rec2.state, "succeeded")
            # AWS call count must STILL be 1 (boto3 was NOT called twice!)
            self.assertEqual(mock_ec2.revoke_security_group_ingress.call_count, 1)

    def _create_sample_finding(self, finding_id: str = "live-sg-0123456789abcdef0") -> FindingModel:
        return FindingModel(
            id=finding_id,
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
            detectedAt="2026-10-23T01:00:00Z",
            affectedService="Amazon VPC",
            recommendedAction="Revoke 0.0.0.0/0 rule",
            operation="ec2:RevokeSecurityGroupIngress",
            operationParams={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": "22", "ToPort": "22"},
            recoveryGuidance=["aws ec2 authorize-security-group-ingress --group-id sg-0123456789abcdef0 --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ap-south-1"],
            beforeState="TCP:22 OPEN",
            afterState="TCP:22 CLOSED",
            execution_mode="live"
        )

    # ── 5. Stale and Parameter-Mutated Safety Passports Rejected ──────────────
    def test_stale_passport_flagged_on_revalidation(self):
        """Safety Passport exceeding freshness window is flagged stale on revalidation."""
        finding = self._create_sample_finding("find-stale-01")
        # Build passport with 1-second freshness limit
        passport = build_safety_passport(finding, freshness_limit_seconds=1)
        # Sleep 1.2s to exceed freshness limit
        time.sleep(1.2)

        is_valid, reason, updated_passport = revalidate_safety_passport_before_execution(
            passport=passport,
            target_finding=finding,
            live_ec2_client=None,
            mode="demo"
        )
        self.assertTrue(updated_passport.is_stale)

    def test_parameter_tampering_invalidates_safety_passport(self):
        """Altering action parameters invalidates Safety Passport and blocks execution."""
        finding = self._create_sample_finding("find-tamper-01")
        passport = build_safety_passport(finding)

        # Mutate finding parameters to something else (e.g. port 80 or different CIDR)
        tampered_finding = finding.model_copy(deep=True)
        tampered_finding.operationParams = {
            "GroupId": "sg-0123456789abcdef0",
            "CidrIp": "10.0.0.0/16",
            "FromPort": "80",
            "ToPort": "80"
        }

        is_valid, reason, updated_passport = revalidate_safety_passport_before_execution(
            passport=passport,
            target_finding=tampered_finding,
            live_ec2_client=None,
            mode="live"
        )
        self.assertFalse(is_valid)
        self.assertTrue(updated_passport.is_safety_blocked)
        self.assertIn("SAFETY VIOLATION", reason)
        self.assertIn("Safety Passport invalidated", reason)

    # ── 6. Verification Failure Prevents Succeeded Status ─────────────────────
    def test_verification_failure_fails_closed(self):
        """If AWS mutation succeeds but verification finds rule still present, state is verification_failed."""
        mock_ec2 = MagicMock()
        # Both before and after describe calls report rule is STILL present!
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
            "ResponseMetadata": {"RequestId": "aws-req-rev-fake"}
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
                actor_email="devops@acmecloud.io",
                finding_id="find-fail-verify-01",
                credentials=live_creds,
                idempotency_key="idemp-fail-verify-001",
                mode="live"
            )

        self.assertEqual(record.state, "verification_failed")
        self.assertIn("Verification failed", record.error_message)

    # ── 7. Cryptographic Hash-Chain Tamper Detection ──────────────────────────
    def test_audit_ledger_tampering_is_detected(self):
        """Altering a committed audit event breaks the SHA-256 hash chain and is flagged."""
        org_id = "org-audit-security-test"
        
        # Ensure org exists
        with get_db_transaction() as conn:
            conn.execute("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, 'Security Test Org', datetime('now'))", (org_id,))
            conn.execute("DELETE FROM audit_events WHERE organization_id = ?", (org_id,))

        # Record 2 events
        ev1 = AuditRepository.record_event(
            org_id=org_id,
            event_data={
                "id": "aud-sec-01",
                "finding_id": "find-sec-01",
                "resource_id": "sg-0123456789abcdef0",
                "action": "ec2:RevokeSecurityGroupIngress",
                "actor_email": "scanner@cloudpilot.io",
                "outcome": "succeeded",
                "aws_request_id": "aws-req-111",
                "timestamp": "2026-10-23T01:00:00Z"
            }
        )

        ev2 = AuditRepository.record_event(
            org_id=org_id,
            event_data={
                "id": "aud-sec-02",
                "finding_id": "find-sec-02",
                "resource_id": "sg-0123456789abcdef0",
                "action": "ec2:RevokeSecurityGroupIngress",
                "actor_email": "devops@acmecloud.io",
                "outcome": "succeeded",
                "aws_request_id": "aws-req-222",
                "timestamp": "2026-10-23T01:05:00Z"
            }
        )

        # Before tampering: chain is verified valid
        audit_res = AuditRepository.verify_ledger_chain(org_id)
        self.assertTrue(audit_res["is_valid"])
        self.assertFalse(audit_res["tamper_detected"])
        self.assertEqual(audit_res["total_events"], 2)

        # Simulate adversarial SQLite update tampering with event 1 canonical payload
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE audit_events SET canonical_payload = 'TAMPERED_PAYLOAD_BY_ATTACKER' WHERE id = ?",
                (ev1["id"],)
            )
            conn.commit()
        finally:
            conn.close()

        # After tampering: verify_ledger_chain must detect the broken cryptographic chain
        tampered_res = AuditRepository.verify_ledger_chain(org_id)
        self.assertFalse(tampered_res["is_valid"])
        self.assertTrue(tampered_res["tamper_detected"])
        self.assertEqual(tampered_res["tampered_event_id"], ev1["id"])


if __name__ == "__main__":
    unittest.main()
