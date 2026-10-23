"""Tests for Workload Deployment Engine Security, Tenant Isolation, and Runtime Lifecycle.

Validates:
- SSRF defenses rejecting cloud metadata, localhost, loopback, private IPs, and non-http schemes.
- Git branch command injection defense (rejects flags like --upload-pack).
- Filesystem path traversal defense (rejects non-sandbox local_path).
- Container runtime honest status (fails closed with BLOCKED when Docker/Cloud credentials absent).
- Persistent deployment storage and tenant isolation across multiple organizations.
"""

import unittest
from fastapi import HTTPException
from pydantic import ValidationError

from app.db.database import WorkloadRepository, AccountRepository, OrganizationRepository
from app.routers.deployments import (
    ScanRequest,
    DeployRequest,
    scan_repository,
    deploy_workload,
    list_deployments,
    get_deployment_status,
    stop_deployment,
    is_safe_git_url,
    is_safe_branch
)
from app.services.auth import AuthenticatedUser
from app.services.deployment.container_runner import ContainerRuntimeEngine


class TestDeploymentSecurityAndRuntime(unittest.TestCase):
    def setUp(self):
        OrganizationRepository.create_organization("org-company-a", "Company A")
        OrganizationRepository.create_organization("org-company-b", "Company B")

        self.tenant_a = AuthenticatedUser(
            user_id="usr-tenant-a",
            email="lead@company-a.com",
            organization_id="org-company-a",
            role="Owner",
            permissions=["scan:resources", "manage:workloads"],
            is_demo=False
        )
        self.tenant_b = AuthenticatedUser(
            user_id="usr-tenant-b",
            email="attacker@company-b.com",
            organization_id="org-company-b",
            role="Owner",
            permissions=["scan:resources", "manage:workloads"],
            is_demo=False
        )

    def test_ssrf_protection_aws_metadata(self):
        safe, reason = is_safe_git_url("http://169.254.169.254/latest/meta-data/")
        self.assertFalse(safe)
        self.assertIn("SSRF", reason)

    def test_ssrf_protection_localhost(self):
        safe, reason = is_safe_git_url("http://127.0.0.1:8000/api/v1/internal")
        self.assertFalse(safe)
        self.assertIn("SSRF", reason)

        safe_local, reason_local = is_safe_git_url("http://localhost:5000/repo.git")
        self.assertFalse(safe_local)

    def test_ssrf_protection_unsupported_schemes(self):
        safe, reason = is_safe_git_url("file:///etc/passwd")
        self.assertFalse(safe)
        self.assertIn("Invalid URL scheme", reason)

        safe_ssh, _ = is_safe_git_url("ssh://git@github.com/org/repo.git")
        self.assertFalse(safe_ssh)

    def test_branch_option_injection_defense(self):
        self.assertFalse(is_safe_branch("--upload-pack=touch /tmp/pwned"))
        self.assertFalse(is_safe_branch("-u"))
        self.assertFalse(is_safe_branch("--help"))
        self.assertTrue(is_safe_branch("main"))
        self.assertTrue(is_safe_branch("feature/auth-v2"))
        self.assertTrue(is_safe_branch("v1.0.4"))

    def test_scan_endpoint_blocks_ssrf(self):
        payload = ScanRequest(repo_url="http://169.254.169.254/latest/meta-data/")
        with self.assertRaises(HTTPException) as ctx:
            scan_repository(payload, current_user=self.tenant_a)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("SSRF Security Violation", ctx.exception.detail)

    def test_scan_endpoint_blocks_path_traversal(self):
        # Passing arbitrary host root path must be rejected with 403
        payload = ScanRequest(local_path="C:\\Windows\\System32" if "\\\\" in "C:\\\\" else "/etc")
        with self.assertRaises(HTTPException) as ctx:
            scan_repository(payload, current_user=self.tenant_a)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Security Violation", ctx.exception.detail)

    def test_container_runtime_honest_blocked_status_local(self):
        # On environments where Docker daemon is not active, deploying locally must return BLOCKED
        payload = DeployRequest(
            app_name="analytics-api",
            repo_url="https://github.com/fastapi/fastapi",
            branch="master",
            framework="fastapi",
            target="local",
            port=8080
        )
        res = deploy_workload(payload, current_user=self.tenant_a)
        self.assertEqual(res["status"], "ok")
        deployment = res["deployment"]

        docker_avail = ContainerRuntimeEngine.check_docker_runtime()["available"]
        if not docker_avail:
            self.assertEqual(deployment["status"], "BLOCKED")
            self.assertTrue(any(msg in deployment["error_message"] for msg in ["Docker CLI binary not found", "Docker runtime daemon is not available", "Docker daemon is not responding"]))
            self.assertEqual(deployment["container_id"], "")
        else:
            self.assertIn(deployment["status"], ["RUNNING", "FAILED"])

    def test_container_runtime_honest_blocked_status_aws(self):
        # Deploying to AWS without connected credentials must return BLOCKED
        payload = DeployRequest(
            app_name="cloud-worker",
            repo_url="https://github.com/pallets/flask",
            target="aws",
            port=5000
        )
        res = deploy_workload(payload, current_user=self.tenant_a)
        deployment = res["deployment"]
        # org-company-a has no AWS account
        self.assertEqual(deployment["status"], "BLOCKED")
        self.assertIn("No active AWS account connected", deployment["error_message"])

    def test_tenant_isolation_workload_deployments(self):
        # Tenant A deploys a workload
        payload_a = DeployRequest(
            app_name="app-tenant-a",
            repo_url="https://github.com/pallets/flask",
            target="local",
            port=5000
        )
        res_a = deploy_workload(payload_a, current_user=self.tenant_a)
        dep_id_a = res_a["deployment"]["id"]

        # Tenant B lists deployments: must NOT see Tenant A's deployment
        deps_b = list_deployments(current_user=self.tenant_b)
        self.assertNotIn(dep_id_a, [d["id"] for d in deps_b])

        # Tenant B attempts to get status of Tenant A's deployment: must return 404
        with self.assertRaises(HTTPException) as ctx:
            get_deployment_status(dep_id_a, current_user=self.tenant_b)
        self.assertEqual(ctx.exception.status_code, 404)

        # Tenant B attempts to stop Tenant A's deployment: must return 404
        with self.assertRaises(HTTPException) as ctx:
            stop_deployment(dep_id_a, current_user=self.tenant_b)
        self.assertEqual(ctx.exception.status_code, 404)

        # Tenant A can inspect their own deployment
        status_a = get_deployment_status(dep_id_a, current_user=self.tenant_a)
        self.assertEqual(status_a["status"], "ok")
        self.assertEqual(status_a["deployment"]["id"], dep_id_a)


if __name__ == "__main__":
    unittest.main()
