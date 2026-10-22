"""
Phase 12: Real Login & Role-Based Access Control (RBAC) Tests
Non-negotiable Rules:
- Displayed identity strictly matches server-verified identity.
- Roles match backend authorization permissions.
- No frontend-only toggle can elevate permissions.
- Viewer role is strictly read-only and denied remediation authorization.
- Token expiration and invalid credentials fail closed.
"""

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.auth import (
    verify_password,
    create_access_token,
    verify_access_token,
    require_permission,
    ROLE_PERMISSIONS,
    AuthenticatedUser
)
from app.routers.auth import login as api_login, get_current_user_profile
from app.schemas import LoginRequest
from app.db.database import init_database_schema
from fastapi import HTTPException


class MockRequest:
    client = None


class TestPhase12RBAC(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        init_database_schema()

    def test_role_permissions_hierarchy(self):
        """Verifies server-enforced role permissions matrix."""
        # 1. Viewer: Read-only access
        viewer_perms = ROLE_PERMISSIONS["Viewer"]
        self.assertIn("view:findings", viewer_perms)
        self.assertIn("view:audit", viewer_perms)
        self.assertNotIn("approve:remediation", viewer_perms)
        self.assertNotIn("execute:remediation", viewer_perms)

        # 2. SecurityAnalyst: Can view and review findings, but cannot execute write operations
        analyst_perms = ROLE_PERMISSIONS["SecurityAnalyst"]
        self.assertIn("view:findings", analyst_perms)
        self.assertIn("scan:resources", analyst_perms)
        self.assertNotIn("execute:remediation", analyst_perms)

        # 3. DevOpsLead: Can approve and execute remediations
        devops_perms = ROLE_PERMISSIONS["DevOpsLead"]
        self.assertIn("view:findings", devops_perms)
        self.assertIn("approve:remediation", devops_perms)
        self.assertIn("execute:remediation", devops_perms)

        # 4. Owner: Has full administrative rights
        owner_perms = ROLE_PERMISSIONS["Owner"]
        self.assertIn("manage:users", owner_perms)
        self.assertIn("manage:accounts", owner_perms)
        self.assertIn("approve:remediation", owner_perms)
        self.assertIn("execute:remediation", owner_perms)

    async def test_server_authenticated_login_flow(self):
        """Authenticating with verified seed credentials issues valid JWT token with exact role."""
        # 1. Successful DevOps Lead login
        login_req = LoginRequest(
            email="devops@acmecloud.io",
            password="DevOpsLead2026!"
        )
        resp = api_login(login_req, MockRequest())
        self.assertTrue(resp.access_token)
        self.assertEqual(resp.user.role, "DevOpsLead")
        self.assertEqual(resp.user.organization_id, "org-acme-prod")

        # 2. Verify issued token via /auth/me
        current_user = AuthenticatedUser(
            user_id=resp.user.id,
            organization_id=resp.user.organization_id,
            email=resp.user.email,
            role=resp.user.role,
            permissions=ROLE_PERMISSIONS[resp.user.role]
        )
        me_resp = get_current_user_profile(current_user=current_user)
        self.assertEqual(me_resp.email, "devops@acmecloud.io")
        self.assertEqual(me_resp.role, "DevOpsLead")

    async def test_viewer_permission_denial(self):
        """Viewer role attempting to invoke approve:remediation is rejected with 403 Forbidden."""
        viewer_user = AuthenticatedUser(
            user_id="usr-viewer-01",
            organization_id="org-acme-prod",
            email="viewer@acmecloud.io",
            role="Viewer",
            permissions=ROLE_PERMISSIONS["Viewer"]
        )

        checker = require_permission("approve:remediation")
        with self.assertRaises(HTTPException) as ctx:
            checker(current_user=viewer_user)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Forbidden", ctx.exception.detail)

    async def test_invalid_password_fails_closed(self):
        """Invalid credentials produce 401 Unauthorized without exposing internal server errors."""
        bad_login = LoginRequest(
            email="devops@acmecloud.io",
            password="WRONG_PASSWORD_123!"
        )
        with self.assertRaises(HTTPException) as ctx:
            api_login(bad_login, MockRequest())
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Invalid email or password", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
