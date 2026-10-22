"""
Phase 6 Tests: Server-Side Authentication, RBAC, and Tenant Isolation
Covers:
- Password hashing and verification (PBKDF2-HMAC-SHA256)
- Signed Bearer token issuance and cryptographic verification
- Expired token rejection (401)
- Tampered token signature rejection (401)
- Unauthenticated requests in live mode rejected (401)
- Role-based access control (RBAC): Viewer role lacks approve:remediation permission (403)
- Cross-tenant isolation: user from org-evil-tenant blocked from org-acme-prod findings (403)
- Identity binding (Anti-Spoofing): user_email in request body cannot spoof caller identity
- Login rate limiting: 5+ failed attempts trigger 429
- Login authentication with valid and invalid credentials
"""

import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
from fastapi import HTTPException

from app.schemas import (
    FindingModel,
    ResourceModel,
    ApproveRequest,
    AuthenticatedUser,
    LoginRequest
)
from app.services.auth import (
    create_access_token,
    verify_access_token,
    hash_password,
    verify_password,
    check_rate_limit,
    get_current_user,
    require_permission,
    enforce_tenant_isolation,
    ROLE_PERMISSIONS,
    USERS_DB,
    _RATE_LIMIT_STORE
)
from app.routers.auth import login
from app.routers.discovery import _cached_findings, approve_finding


class TestPhase6AuthAndRBAC(unittest.TestCase):

    def setUp(self):
        _RATE_LIMIT_STORE.clear()
        _cached_findings.clear()

        # Seed sample finding in org-acme-prod
        self.finding = FindingModel(
            id="find-acme-prod-101",
            category="security",
            severity="critical",
            title="Prod SSH Open",
            description="Prod SSH open",
            rule="SEC-SG-001",
            resource=ResourceModel(
                id="sg-0123456789abcdef0",
                type="AWS::EC2::SecurityGroup",
                name="prod-sg",
                region="ap-south-1",
                age="10d",
                account_id="123456789012"
            ),
            evidence=["Verified rule TCP:22 from 0.0.0.0/0"],
            status="open",
            detectedAt=datetime.now(timezone.utc).isoformat(),
            affectedService="Amazon VPC",
            recommendedAction="Revoke",
            operation="ec2:RevokeSecurityGroupIngress",
            operationParams={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": "22", "ToPort": "22"},
            beforeState="TCP:22 OPEN",
            afterState="TCP:22 CLOSED",
            execution_mode="live",
            organization_id="org-acme-prod"
        )
        _cached_findings["live:find-acme-prod-101"] = self.finding
        _cached_findings["demo:find-acme-prod-101"] = self.finding

    # ── Test 1: Password Hashing & Verification ───────────────────────────────
    def test_password_hashing_and_verification(self):
        h, salt = hash_password("SecretPassword123!")
        self.assertTrue(verify_password("SecretPassword123!", h, salt))
        self.assertFalse(verify_password("WrongPassword!", h, salt))

    # ── Test 2: Token Creation, Expiration, and Signature Tampering ───────────
    def test_token_creation_and_verification(self):
        user = USERS_DB["devops@acmecloud.io"]
        token, expires_in = create_access_token(user)
        self.assertGreater(expires_in, 0)

        payload = verify_access_token(token)
        self.assertEqual(payload["email"], "devops@acmecloud.io")
        self.assertEqual(payload["role"], "DevOpsLead")
        self.assertEqual(payload["org_id"], "org-acme-prod")

    def test_expired_token_rejection(self):
        user = USERS_DB["devops@acmecloud.io"]
        # Negative delta for already-expired token
        expired_token, _ = create_access_token(user, expires_delta=timedelta(seconds=-10))
        with self.assertRaises(HTTPException) as ctx:
            verify_access_token(expired_token)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("expired", ctx.exception.detail.lower())

    def test_tampered_token_signature_rejection(self):
        user = USERS_DB["devops@acmecloud.io"]
        token, _ = create_access_token(user)
        parts = token.split(".")
        # Tamper signature part
        tampered_token = f"{parts[0]}.badsignature123456789"
        with self.assertRaises(HTTPException) as ctx:
            verify_access_token(tampered_token)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("invalid token signature", ctx.exception.detail.lower())

    # ── Test 3: Unauthenticated Protected Endpoints Rejected (401) ───────────
    def test_unauthenticated_request_rejected(self):
        # In live mode without authorization header, must raise 401
        with self.assertRaises(HTTPException) as ctx:
            get_current_user(authorization=None, mode="live")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Authentication required", ctx.exception.detail)

    # ── Test 4: Role-Based Access Control (RBAC) ──────────────────────────────
    def test_viewer_role_cannot_approve(self):
        viewer_user = AuthenticatedUser(
            user_id="usr-viewer",
            email="viewer@acmecloud.io",
            organization_id="org-acme-prod",
            role="Viewer",
            permissions=ROLE_PERMISSIONS["Viewer"]
        )

        permission_checker = require_permission("approve:remediation")
        with self.assertRaises(HTTPException) as ctx:
            permission_checker(viewer_user)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("lacks required permission 'approve:remediation'", ctx.exception.detail)

    def test_devops_lead_can_approve(self):
        devops_user = AuthenticatedUser(
            user_id="usr-devops",
            email="devops@acmecloud.io",
            organization_id="org-acme-prod",
            role="DevOpsLead",
            permissions=ROLE_PERMISSIONS["DevOpsLead"]
        )

        permission_checker = require_permission("approve:remediation")
        user = permission_checker(devops_user)
        self.assertEqual(user.email, "devops@acmecloud.io")

    # ── Test 5: Cross-Tenant Isolation Rejects Access (403) ───────────────────
    def test_cross_tenant_access_rejected(self):
        # Attacker from org-evil-tenant
        attacker = AuthenticatedUser(
            user_id="usr-attacker",
            email="attacker@evilcorp.io",
            organization_id="org-evil-tenant",
            role="Admin",
            permissions=ROLE_PERMISSIONS["Admin"]
        )

        req = ApproveRequest(mode="demo", user_email="attacker@evilcorp.io")
        with self.assertRaises(HTTPException) as ctx:
            approve_finding("find-acme-prod-101", req, current_user=attacker)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("You do not have access to resources in tenant 'org-acme-prod'", ctx.exception.detail)

    # ── Test 6: Anti-Spoofing: Caller Email Bound to Token, Not Payload ───────
    def test_anti_spoofing_binds_actor_to_verified_identity(self):
        # Legitimate DevOps user in org-acme-prod
        devops_user = AuthenticatedUser(
            user_id="usr-devops",
            email="devops@acmecloud.io",
            organization_id="org-acme-prod",
            role="DevOpsLead",
            permissions=ROLE_PERMISSIONS["DevOpsLead"]
        )

        # Caller attempts to spoof CEO email in payload
        req = ApproveRequest(mode="demo", user_email="ceo@acmecloud.io")
        res = approve_finding("find-acme-prod-101", req, current_user=devops_user)

        self.assertTrue(res.success)
        # Canonical payload and audit receipt must reflect authenticated devops@acmecloud.io, NOT ceo@acmecloud.io!
        self.assertIn("devops@acmecloud.io", res.canonical_payload)
        self.assertNotIn("ceo@acmecloud.io", res.canonical_payload)

    # ── Test 7: Login Rate Limiting (429) ─────────────────────────────────────
    def test_login_rate_limiting(self):
        key = "127.0.0.1:test@example.com"
        for _ in range(5):
            self.assertTrue(check_rate_limit(key, max_attempts=5, window_seconds=60))
        # 6th attempt in window must fail
        self.assertFalse(check_rate_limit(key, max_attempts=5, window_seconds=60))

    # ── Test 8: Login Endpoint Success & Invalid Password ─────────────────────
    def test_login_endpoint(self):
        mock_req = MagicMock()
        mock_req.client.host = "192.168.1.10"

        # Correct credentials
        res = login(LoginRequest(email="admin@acmecloud.io", password="CloudPilotAdmin2026!"), mock_req)
        self.assertEqual(res.token_type, "bearer")
        self.assertEqual(res.user.email, "admin@acmecloud.io")
        self.assertEqual(res.user.role, "Owner")
        self.assertGreater(len(res.access_token), 20)

        # Incorrect password
        with self.assertRaises(HTTPException) as ctx:
            login(LoginRequest(email="admin@acmecloud.io", password="WrongPassword123!"), mock_req)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Invalid email or password", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
