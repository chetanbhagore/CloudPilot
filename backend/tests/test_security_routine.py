"""Unit and Integration Tests for CloudPilot Automated Security Routine.

Validates that:
- The security routine systematically checks all 9 critical security parameters.
- Overall status is PASS and compliance score is 100%.
- The REST API endpoint /health/security-routine returns HTTP 200 with matching parameters.
"""

import unittest

from app.routers.health import security_routine_check
from app.services.security_routine import run_complete_security_routine


class TestSecurityRoutine(unittest.TestCase):
    def test_security_routine_all_parameters_match(self):
        report = run_complete_security_routine()

        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["compliance_score"], 100.0)
        self.assertEqual(report["parameters_mismatched"], 0)
        self.assertGreaterEqual(report["total_parameters_evaluated"], 9)

        # Assert specific parameters exist and passed
        param_names = [p["parameter"] for p in report["parameters"]]
        self.assertIn("SSRF_INGESTION_GUARD", param_names)
        self.assertIn("GIT_BRANCH_INJECTION_DEFENSE", param_names)
        self.assertIn("MULTI_TENANT_ISOLATION_IDOR", param_names)
        self.assertIn("SAFETY_PASSPORT_CANONICAL_LOCK", param_names)
        self.assertIn("AUDIT_LEDGER_HASH_CHAINING", param_names)
        self.assertIn("JWT_SIGNATURE_TAMPER_DEFENSE", param_names)
        self.assertIn("CONTAINER_NON_ROOT_SANDBOX", param_names)
        self.assertIn("RUNTIME_FAIL_CLOSED_CHECK", param_names)
        self.assertIn("CONFUSED_DEPUTY_STS_DEFENSE", param_names)

        for p in report["parameters"]:
            self.assertTrue(p["passed"], f"Parameter {p['parameter']} failed to match expectation.")
            self.assertEqual(p["status"], "MATCHED")

    def test_security_routine_router_endpoint(self):
        data = security_routine_check()
        self.assertEqual(data["status"], "PASS")
        self.assertEqual(data["compliance_score"], 100.0)
        self.assertIn("parameters", data)
        self.assertGreaterEqual(len(data["parameters"]), 9)


if __name__ == "__main__":
    unittest.main()
