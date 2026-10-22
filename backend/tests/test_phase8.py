"""
Phase 8 Tests: Explicit, Reliable Failure Handling and Bounded Retries
Covers:
- AWS error classification (throttling, permissions, timeouts, not found)
- Bounded retries with exponential backoff for transient errors
- Immediate fail-fast without retries for permission errors
- Prevention of duplicate non-idempotent mutations during failures
- Standardized error formatting without internal stack trace leakage
"""

import json
import unittest
from unittest.mock import MagicMock
from botocore.exceptions import ClientError

from app.services.resilience import (
    classify_aws_exception,
    execute_bounded_retry,
    format_error_response,
    RETRYABLE_AWS_CODES,
    NON_RETRYABLE_AWS_CODES
)


class TestPhase8ResilienceAndFailures(unittest.TestCase):

    # ── Test 1: AWS Exception Classification ──────────────────────────────────
    def test_aws_exception_classification(self):
        # 1. Throttling error
        throttle_err = ClientError(
            {"Error": {"Code": "Throttling", "Message": "Rate exceeded"}},
            "DescribeVolumes"
        )
        status, code, cat, retryable = classify_aws_exception(throttle_err)
        self.assertEqual(status, 429)
        self.assertEqual(code, "Throttling")
        self.assertEqual(cat, "aws_throttling_error")
        self.assertTrue(retryable)

        # 2. Permission error (AccessDenied)
        denied_err = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Not authorized"}},
            "RevokeSecurityGroupIngress"
        )
        status, code, cat, retryable = classify_aws_exception(denied_err)
        self.assertEqual(status, 403)
        self.assertEqual(code, "AccessDenied")
        self.assertEqual(cat, "aws_permission_error")
        self.assertFalse(retryable)

        # 3. Resource Not Found
        not_found_err = ClientError(
            {"Error": {"Code": "InvalidGroup.NotFound", "Message": "The Security Group does not exist."}},
            "DescribeSecurityGroups"
        )
        status, code, cat, retryable = classify_aws_exception(not_found_err)
        self.assertEqual(status, 404)
        self.assertEqual(cat, "resource_not_found")
        self.assertFalse(retryable)

    # ── Test 2: Bounded Retry Logic with Transient Failure Recovery ───────────
    def test_bounded_retry_recovers_after_transient_throttling(self):
        calls = []

        def transient_operation():
            calls.append(1)
            if len(calls) < 3:
                raise ClientError(
                    {"Error": {"Code": "Throttling", "Message": "Rate exceeded"}},
                    "DescribeSecurityGroups"
                )
            return "recovered_result"

        result = execute_bounded_retry(
            transient_operation,
            operation_name="DescribeSecurityGroups",
            max_retries=3,
            backoff_base=0.01  # fast backoff for tests
        )

        self.assertEqual(result, "recovered_result")
        self.assertEqual(len(calls), 3)

    # ── Test 3: Non-Retryable Errors Fail Immediately Without Retrying ────────
    def test_non_retryable_error_fails_immediately(self):
        calls = []

        def permission_denied_operation():
            calls.append(1)
            raise ClientError(
                {"Error": {"Code": "UnauthorizedOperation", "Message": "You are not authorized"}},
                "RevokeSecurityGroupIngress"
            )

        with self.assertRaises(ClientError):
            execute_bounded_retry(
                permission_denied_operation,
                operation_name="RevokeSecurityGroupIngress",
                max_retries=3,
                backoff_base=0.01
            )

        # Must NOT retry: executed exactly once
        self.assertEqual(len(calls), 1)

    # ── Test 4: Non-Idempotent Mutations Without Idempotency Key Never Retried ─
    def test_non_idempotent_mutation_not_retried_without_key(self):
        calls = []

        def mutation_operation():
            calls.append(1)
            raise ClientError(
                {"Error": {"Code": "Throttling", "Message": "Rate exceeded"}},
                "ModifyVolume"
            )

        with self.assertRaises(ClientError):
            execute_bounded_retry(
                mutation_operation,
                operation_name="ModifyVolume",
                max_retries=3,
                is_mutation=True,
                idempotency_key=None  # No duplicate protection
            )

        # Mutation without idempotency key must never automatically retry
        self.assertEqual(len(calls), 1)

    # ── Test 5: Standard Error Response Formatting ────────────────────────────
    def test_standard_error_response_formatting(self):
        response = format_error_response(
            status_code=403,
            error_code="AWS_ACCESS_DENIED",
            category="aws_permission_error",
            message="User is not authorized to perform sts:AssumeRole",
            detail="Role trust policy rejected assumed-role call.",
            retryable=False
        )

        self.assertEqual(response.status_code, 403)
        body = json.loads(response.body.decode("utf-8"))

        self.assertEqual(body["error_code"], "AWS_ACCESS_DENIED")
        self.assertEqual(body["category"], "aws_permission_error")
        self.assertFalse(body["retryable"])
        self.assertIn("correlation_id", body)
        self.assertIn("timestamp", body)
        # Verify no internal server stack or credentials are leaked
        self.assertNotIn("Traceback", json.dumps(body))
        self.assertNotIn("secret_key", json.dumps(body))


if __name__ == "__main__":
    unittest.main()
