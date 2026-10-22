"""
Phase 10: Trustworthy Cryptographic Audit Trail & Proof of Outcome Tests
Non-negotiable Rules:
- Append-only event log with sequential cryptographic hash chaining.
- Tamper detection identifies modified payloads or broken previous_hash links.
- Scoped strictly to authenticated tenant organization.
- Failed and blocked executions are recorded alongside successful ones.
- CloudTrail cross-check hints are attached to every record.
- Clear disclaimer: hash proves database ledger immutability, while external AWS state is corroborated via CloudTrail.
"""

import unittest
import json
import sqlite3
import hashlib
import sys
from pathlib import Path
from typing import Dict, Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.database import (
    AuditRepository,
    get_db_connection,
    get_db_transaction,
    init_database_schema
)
from app.services.auth import AuthenticatedUser
from app.routers.audit import (
    get_audit_events,
    verify_audit_ledger,
    export_audit_ledger
)


class TestPhase10AuditTrail(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        init_database_schema()
        self.org_a = "org-audit-tenant-a"
        self.org_b = "org-audit-tenant-b"

        # Clean test tenant records
        with get_db_transaction() as conn:
            conn.execute("DELETE FROM audit_events WHERE organization_id IN (?, ?)", (self.org_a, self.org_b))
            conn.execute("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, 'Tenant A', datetime('now'))", (self.org_a,))
            conn.execute("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, 'Tenant B', datetime('now'))", (self.org_b,))

        self.user_a = AuthenticatedUser(
            user_id="usr-a1",
            organization_id=self.org_a,
            email="sec-lead@tenant-a.com",
            role="DevOpsLead",
            permissions=["view:findings", "approve:remediation", "execute:remediation", "view:audit"]
        )

        self.user_b = AuthenticatedUser(
            user_id="usr-b1",
            organization_id=self.org_b,
            email="auditor@tenant-b.com",
            role="Viewer",
            permissions=["view:findings", "view:audit"]
        )

    def test_record_and_chain_integrity(self):
        """Events are hashed sequentially, starting with GENESIS and linking each previous_hash."""
        # Record Event 1
        ev1 = AuditRepository.record_event(self.org_a, {
            "id": "aud-001",
            "finding_id": "find-101",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-111122223333",
            "actor_email": "engineer@tenant-a.com",
            "aws_request_id": "req-aws-real-001",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T01:00:00Z",
            "execution_mode": "live",
            "account_id": "123456789012",
            "region": "ap-south-1",
            "verification_status": "verified"
        })

        self.assertEqual(ev1["previous_hash"], "GENESIS")
        self.assertTrue(len(ev1["integrity_hash"]) == 64)

        # Record Event 2
        ev2 = AuditRepository.record_event(self.org_a, {
            "id": "aud-002",
            "finding_id": "find-102",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-444455556666",
            "actor_email": "lead@tenant-a.com",
            "aws_request_id": "req-aws-real-002",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T01:05:00Z",
            "execution_mode": "live",
            "account_id": "123456789012",
            "region": "ap-south-1",
            "verification_status": "verified"
        })

        self.assertEqual(ev2["previous_hash"], ev1["integrity_hash"])

        # Verify whole chain
        report = AuditRepository.verify_ledger_chain(self.org_a)
        self.assertTrue(report["is_valid"])
        self.assertFalse(report["tamper_detected"])
        self.assertEqual(report["total_events"], 2)
        self.assertEqual(report["root_hash"], ev2["integrity_hash"])
        self.assertIn("CloudTrail", report["disclaimer"])

    def test_tamper_detection_on_altered_database_record(self):
        """Direct malicious modification of payload in SQLite fails chain verification."""
        AuditRepository.record_event(self.org_a, {
            "id": "aud-tamper-target",
            "finding_id": "find-201",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-original",
            "actor_email": "legit@tenant-a.com",
            "aws_request_id": "req-001",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T01:00:00Z",
            "execution_mode": "live"
        })

        # Malicious attacker directly tampers with the canonical payload in the database
        with get_db_transaction() as conn:
            conn.execute(
                "UPDATE audit_events SET canonical_payload = ? WHERE id = ?",
                ("TAMPERED_PAYLOAD_FAKE", "aud-tamper-target")
            )

        report = AuditRepository.verify_ledger_chain(self.org_a)
        self.assertFalse(report["is_valid"])
        self.assertTrue(report["tamper_detected"])
        self.assertEqual(report["tampered_event_id"], "aud-tamper-target")
        self.assertIn("tamper detected", report["error"].lower())

    def test_tamper_detection_on_broken_hash_link(self):
        """Modification of previous_hash link flags chain break."""
        AuditRepository.record_event(self.org_a, {
            "id": "aud-link-1",
            "finding_id": "find-301",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-1",
            "actor_email": "eng@tenant-a.com",
            "aws_request_id": "req-1",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T01:00:00Z"
        })
        AuditRepository.record_event(self.org_a, {
            "id": "aud-link-2",
            "finding_id": "find-302",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-2",
            "actor_email": "eng@tenant-a.com",
            "aws_request_id": "req-2",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T01:02:00Z"
        })

        # Break the link
        with get_db_transaction() as conn:
            conn.execute(
                "UPDATE audit_events SET previous_hash = 'BROKEN_HASH' WHERE id = 'aud-link-2'"
            )

        report = AuditRepository.verify_ledger_chain(self.org_a)
        self.assertFalse(report["is_valid"])
        self.assertTrue(report["tamper_detected"])
        self.assertEqual(report["tampered_event_id"], "aud-link-2")
        self.assertIn("chain break", report["error"].lower())

    def test_tenant_isolation_in_audit_ledger(self):
        """Tenant A's events are never visible to Tenant B."""
        AuditRepository.record_event(self.org_a, {
            "id": "aud-tenant-a-event",
            "finding_id": "find-a",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-secret-a",
            "actor_email": "admin@tenant-a.com",
            "aws_request_id": "req-a-secret",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T01:00:00Z"
        })

        events_a = AuditRepository.list_events(self.org_a)
        events_b = AuditRepository.list_events(self.org_b)

        self.assertEqual(len(events_a), 1)
        self.assertEqual(len(events_b), 0)
        self.assertEqual(events_a[0]["resource_id"], "sg-secret-a")

    def test_failed_and_blocked_remediations_recorded(self):
        """Failed and safety-blocked attempts are recorded with true outcome, never disguised as success."""
        AuditRepository.record_event(self.org_a, {
            "id": "aud-failed-001",
            "finding_id": "find-fail",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-bad-perm",
            "actor_email": "dev@tenant-a.com",
            "aws_request_id": "none",
            "outcome": "failed",
            "timestamp": "2026-10-23T01:10:00Z",
            "verification_status": "failed",
            "verification_evidence": {"error": "UnauthorizedOperation"}
        })

        AuditRepository.record_event(self.org_a, {
            "id": "aud-blocked-001",
            "finding_id": "find-blocked",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-stale-passport",
            "actor_email": "dev@tenant-a.com",
            "aws_request_id": "blocked-before-execution",
            "outcome": "blocked",
            "timestamp": "2026-10-23T01:12:00Z",
            "verification_status": "blocked",
            "verification_evidence": {"block_reason": "Safety Passport is stale"}
        })

        failed_events = AuditRepository.list_events(self.org_a, outcome="failed")
        blocked_events = AuditRepository.list_events(self.org_a, outcome="blocked")

        self.assertEqual(len(failed_events), 1)
        self.assertEqual(failed_events[0]["id"], "aud-failed-001")
        self.assertEqual(len(blocked_events), 1)
        self.assertEqual(blocked_events[0]["id"], "aud-blocked-001")

    async def test_audit_api_endpoints(self):
        """Test API router endpoints /audit/events, /audit/verify, and /audit/export."""
        AuditRepository.record_event(self.org_a, {
            "id": "aud-api-01",
            "finding_id": "find-api-01",
            "action": "ec2:RevokeSecurityGroupIngress",
            "resource_id": "sg-api-01",
            "actor_email": "sec-lead@tenant-a.com",
            "aws_request_id": "req-api-aws-01",
            "outcome": "succeeded",
            "timestamp": "2026-10-23T01:15:00Z",
            "execution_mode": "live",
            "account_id": "123456789012",
            "region": "ap-south-1",
            "verification_status": "verified"
        })

        # 1. GET /audit/events
        events = await get_audit_events(mode="live", outcome=None, current_user=self.user_a)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["id"], "aud-api-01")

        # 2. GET /audit/verify
        verification = await verify_audit_ledger(current_user=self.user_a)
        self.assertTrue(verification["is_valid"])
        self.assertFalse(verification["tamper_detected"])

        # 3. GET /audit/export as JSON
        json_export = await export_audit_ledger(format="json", mode="live", current_user=self.user_a)
        self.assertEqual(json_export["organization_id"], self.org_a)
        self.assertEqual(json_export["total_events"], 1)

        # 4. GET /audit/export as CSV
        csv_resp = await export_audit_ledger(format="csv", mode="live", current_user=self.user_a)
        self.assertIn("aud-api-01", csv_resp.body.decode())
        self.assertIn("req-api-aws-01", csv_resp.body.decode())
        self.assertIn("AWS CloudTrail", csv_resp.body.decode())


if __name__ == "__main__":
    unittest.main()
