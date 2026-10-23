"""
Multi-Tenant SaaS Onboarding & Cross-Tenant Data Isolation Test Suite
Validates:
1. New customer registration (Sign up, organization provisioning, JWT issuance)
2. Strict cross-tenant isolation on accounts, findings, and audit ledgers
3. Password complexity and duplicate registration controls
4. Tamper-evident JWT issuance and cryptographic verification
"""

import unittest
import uuid
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException

from app.schemas import (
    SignupRequest,
    LoginRequest,
    AccountConnectRequest,
    AuthenticatedUser
)
from app.services.auth import (
    register_user,
    create_access_token,
    verify_access_token,
    get_user_by_email,
    enforce_tenant_isolation
)
from app.routers.auth import signup
from app.routers.accounts import connect_account, list_accounts, disconnect_account
from app.routers.discovery import get_findings
from app.db.database import (
    AccountRepository,
    FindingRepository,
    AuditRepository,
    get_db_transaction
)

class TestMultiTenantOnboardingAndIsolation(unittest.TestCase):
    def setUp(self):
        # Generate two isolated tenant identifiers for each test run
        self.tenant_a_slug = f"acme-{uuid.uuid4().hex[:6]}"
        self.tenant_a_email = f"alice@{self.tenant_a_slug}.com"
        self.tenant_b_slug = f"beta-{uuid.uuid4().hex[:6]}"
        self.tenant_b_email = f"bob@{self.tenant_b_slug}.com"

    def test_signup_creates_new_organization_and_owner(self):
        """A new customer can register, creating an isolated organization and Owner account."""
        req = SignupRequest(
            name="Alice Founder",
            email=self.tenant_a_email,
            password="StrongPassword2026!",
            organization_name="Acme HyperScale Corp"
        )
        mock_request = MagicMock()
        mock_request.client.host = f"192.168.1.{uuid.uuid4().int % 250 + 1}"

        resp = signup(req, mock_request)
        self.assertTrue(resp.access_token)
        self.assertEqual(resp.user.email, self.tenant_a_email)
        self.assertEqual(resp.user.role, "Owner")
        self.assertTrue(resp.user.organization_id.startswith("org-"))

        # Verify token is valid and tenant-bound
        payload = verify_access_token(resp.access_token)
        self.assertEqual(payload["email"], self.tenant_a_email)
        self.assertEqual(payload["org_id"], resp.user.organization_id)
        self.assertEqual(payload["role"], "Owner")

    def test_duplicate_email_signup_rejected(self):
        """Duplicate email registration is rejected with 400 Bad Request."""
        user_data, _, _ = register_user(
            name="Alice Duplicate",
            email=self.tenant_a_email,
            password="Password2026!",
            org_name="Duplicate Org"
        )
        self.assertIsNotNone(user_data)

        req = SignupRequest(
            name="Alice Twin",
            email=self.tenant_a_email,
            password="DifferentPassword2026!",
            organization_name="Another Org"
        )
        mock_request = MagicMock()
        mock_request.client.host = "192.168.1.100"

        with self.assertRaises(HTTPException) as ctx:
            signup(req, mock_request)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already registered", ctx.exception.detail)

    def test_weak_password_rejected(self):
        """Passwords shorter than 8 characters are rejected."""
        with self.assertRaises(ValueError) as ctx:
            register_user(
                name="Short Pwd",
                email="short@test.com",
                password="123",
                org_name="Short Corp"
            )
        self.assertIn("at least 8 characters", str(ctx.exception))

    def test_tenant_accounts_isolation(self):
        """Organization B cannot view or list AWS accounts connected by Organization A."""
        # 1. Register Tenant A and Tenant B
        user_a, token_a, _ = register_user(
            name="Alice Tenant",
            email=self.tenant_a_email,
            password="PasswordTenantA2026!",
            org_name="Org Alpha"
        )
        auth_user_a = AuthenticatedUser(
            user_id=user_a["id"],
            email=user_a["email"],
            organization_id=user_a["org_id"],
            role="Owner",
            permissions=["view:accounts", "manage:accounts"],
            is_demo=False
        )

        user_b, token_b, _ = register_user(
            name="Bob Tenant",
            email=self.tenant_b_email,
            password="PasswordTenantB2026!",
            org_name="Org Beta"
        )
        auth_user_b = AuthenticatedUser(
            user_id=user_b["id"],
            email=user_b["email"],
            organization_id=user_b["org_id"],
            role="Owner",
            permissions=["view:accounts", "manage:accounts"],
            is_demo=False
        )

        # 2. Connect account for Tenant A
        account_data = {
            "account_id": "111122223333",
            "role_arn": "arn:aws:iam::111122223333:role/CloudPilotAuditRole",
            "external_id": f"cp-{user_a['org_id']}-ext",
            "region": "us-east-1",
            "execution_mode": "live",
            "status": "connected",
            "alias": "Tenant A Production Account"
        }
        AccountRepository.save_account(user_a["org_id"], account_data)

        # 3. Tenant A lists accounts -> Account is present
        accounts_a = list_accounts(mode="live", current_user=auth_user_a)
        self.assertEqual(len(accounts_a), 1)
        self.assertEqual(accounts_a[0]["account_id"], "111122223333")

        # 4. Tenant B lists accounts -> MUST BE EMPTY!
        accounts_b = list_accounts(mode="live", current_user=auth_user_b)
        self.assertEqual(len(accounts_b), 0)

        # 5. Tenant B attempts to disconnect Tenant A's account -> 404 (not found in Tenant B)
        with self.assertRaises(HTTPException) as ctx:
            disconnect_account("111122223333", mode="live", current_user=auth_user_b)
        self.assertEqual(ctx.exception.status_code, 404)

        # 6. Tenant A disconnects their account -> 200 OK
        resp_disconnect = disconnect_account("111122223333", mode="live", current_user=auth_user_a)
        self.assertTrue(resp_disconnect["success"])

    def test_tenant_findings_isolation(self):
        """Organization B cannot access cloud findings discovered for Organization A."""
        user_a, _, _ = register_user(
            name="Alice Sec",
            email=self.tenant_a_email,
            password="PasswordA2026!",
            org_name="Org Alpha Sec"
        )
        auth_user_a = AuthenticatedUser(
            user_id=user_a["id"],
            email=user_a["email"],
            organization_id=user_a["org_id"],
            role="Owner",
            permissions=["view:findings"],
            is_demo=False
        )

        user_b, _, _ = register_user(
            name="Bob Sec",
            email=self.tenant_b_email,
            password="PasswordB2026!",
            org_name="Org Beta Sec"
        )
        auth_user_b = AuthenticatedUser(
            user_id=user_b["id"],
            email=user_b["email"],
            organization_id=user_b["org_id"],
            role="Owner",
            permissions=["view:findings"],
            is_demo=False
        )

        # Save finding to Tenant A
        finding_id = f"find-{uuid.uuid4().hex[:8]}"
        finding_data = {
            "id": finding_id,
            "category": "security",
            "severity": "critical",
            "title": "Unrestricted Port 22 SSH",
            "description": "Port 22 SSH ingress open to world",
            "rule": "SEC-001",
            "resource": {
                "id": "sg-tenant-a-12345",
                "type": "AWS::EC2::SecurityGroup",
                "name": "prod-bastion",
                "region": "ap-south-1",
                "age": "14d",
                "account_id": "111122223333",
                "tags": {}
            },
            "evidence": ["0.0.0.0/0:22 open"],
            "status": "open",
            "detectedAt": "2026-10-23T00:00:00Z",
            "affectedService": "Amazon VPC",
            "recommendedAction": "Revoke 0.0.0.0/0 ingress rule",
            "operation": "ec2:RevokeSecurityGroupIngress",
            "operationParams": {"GroupId": "sg-tenant-a-12345"},
            "beforeState": "TCP:22 OPEN",
            "afterState": "TCP:22 CLOSED",
            "execution_mode": "live",
            "data_source": "live_aws",
            "organization_id": user_a["org_id"]
        }
        FindingRepository.save_finding(user_a["org_id"], finding_data)

        # Tenant A can view finding
        findings_a = get_findings(mode="live", current_user=auth_user_a)
        matching_a = [f for f in findings_a if f.id == finding_id]
        self.assertEqual(len(matching_a), 1)

        # Tenant B CANNOT view Tenant A's finding
        findings_b = get_findings(mode="live", current_user=auth_user_b)
        matching_b = [f for f in findings_b if f.id == finding_id]
        self.assertEqual(len(matching_b), 0)

        # Explicit cross-tenant access enforcement raises 403
        with self.assertRaises(HTTPException) as ctx:
            enforce_tenant_isolation(user_a["org_id"], auth_user_b)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_tenant_audit_events_isolation(self):
        """Append-only audit events are strictly isolated per tenant organization."""
        from app.db.database import OrganizationRepository
        org_a = f"org-{uuid.uuid4().hex[:6]}"
        org_b = f"org-{uuid.uuid4().hex[:6]}"
        OrganizationRepository.create_organization(org_a, "Org A")
        OrganizationRepository.create_organization(org_b, "Org B")

        AuditRepository.record_event(org_a, {
            "finding_id": "find-a-01",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-0001",
            "actor_email": "alice@alpha.com",
            "aws_request_id": "aws-req-a-1",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T01:00:00Z",
            "execution_mode": "live"
        })

        AuditRepository.record_event(org_b, {
            "finding_id": "find-b-02",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-0002",
            "actor_email": "bob@beta.com",
            "aws_request_id": "aws-req-b-2",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T02:00:00Z",
            "execution_mode": "live"
        })

        events_a = AuditRepository.list_events(org_a)
        self.assertEqual(len(events_a), 1)
        self.assertEqual(events_a[0]["aws_request_id"], "aws-req-a-1")

        events_b = AuditRepository.list_events(org_b)
        self.assertEqual(len(events_b), 1)
        self.assertEqual(events_b[0]["aws_request_id"], "aws-req-b-2")

        # Verify hash chain independently on both
        verif_a = AuditRepository.verify_ledger_chain(org_a)
        self.assertTrue(verif_a["is_valid"])
        self.assertFalse(verif_a["tamper_detected"])

        verif_b = AuditRepository.verify_ledger_chain(org_b)
        self.assertTrue(verif_b["is_valid"])
        self.assertFalse(verif_b["tamper_detected"])

if __name__ == "__main__":
    unittest.main()
