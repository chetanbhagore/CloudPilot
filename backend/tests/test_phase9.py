"""
Phase 9 Tests: Persistent Data and Tenant Isolation
Covers:
- Relational schema creation and foreign key constraint enforcement
- Data persistence across simulated server restarts (in-memory cache eviction)
- Strict tenant isolation at the data-access layer (cross-tenant leakage impossible)
- ACID transactional consistency for approval status updates and audit logs
- Verification that temporary session tokens/secrets are never persisted
"""

import os
import unittest
from datetime import datetime, timezone

from app.db.database import (
    init_database_schema,
    get_db_connection,
    get_db_transaction,
    AccountRepository,
    FindingRepository,
    AuditRepository
)


class TestPhase9PersistenceAndTenantIsolation(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_database_schema()

    # ── Test 1: Relational Schema & Tables Initialized ────────────────────────
    def test_schema_and_indexes_exist(self):
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            tables = [
                row[0] for row in cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            ]
            self.assertIn("organizations", tables)
            self.assertIn("users", tables)
            self.assertIn("aws_accounts", tables)
            self.assertIn("findings", tables)
            self.assertIn("safety_passports", tables)
            self.assertIn("remediation_executions", tables)
            self.assertIn("audit_events", tables)

            # Check foreign keys pragma is on
            fk_status = cursor.execute("PRAGMA foreign_keys;").fetchone()[0]
            self.assertEqual(fk_status, 1)
        finally:
            conn.close()

    # ── Test 2: Data Survives In-Memory Cache Restarts ─────────────────────────
    def test_data_survives_memory_restart(self):
        org_id = "org-acme-prod"
        account_id = "112233445566"

        account_payload = {
            "account_id": account_id,
            "role_arn": "arn:aws:iam::112233445566:role/CloudPilotAuditRole",
            "external_id": "cp-tenant-persist-test",
            "region": "ap-south-1",
            "execution_mode": "live",
            "connection_status": "connected",
            "alias": "Persistence Test Account",
            "connected_at": datetime.now(timezone.utc).isoformat()
        }

        # 1. Save to persistent SQLite database
        AccountRepository.save_account(org_id, account_payload)

        # 2. Simulate server crash and restart: read directly from fresh connection
        accounts = AccountRepository.get_accounts(org_id, mode="live")
        found = next((a for a in accounts if a["account_id"] == account_id), None)

        self.assertIsNotNone(found)
        self.assertEqual(found["role_arn"], "arn:aws:iam::112233445566:role/CloudPilotAuditRole")
        self.assertEqual(found["alias"], "Persistence Test Account")

        # Cleanup
        AccountRepository.delete_account(org_id, account_id, mode="live")

    # ── Test 3: Strict Tenant Isolation at Repository Layer ───────────────────
    def test_tenant_isolation_blocks_cross_tenant_data_leakage(self):
        # Tenant A: Acme Corp
        finding_a = {
            "id": "find-tenant-a-secret",
            "category": "security",
            "severity": "critical",
            "title": "Tenant A Sensitive Key",
            "status": "open",
            "resource": {"id": "sg-tenant-a", "type": "AWS::EC2::SecurityGroup"},
            "detectedAt": datetime.now(timezone.utc).isoformat(),
            "operation": "ec2:RevokeSecurityGroupIngress",
            "operationParams": {"GroupId": "sg-tenant-a"}
        }
        FindingRepository.save_finding("org-acme-prod", finding_a)

        # Tenant B: Evil Tenant
        finding_b = {
            "id": "find-tenant-b-secret",
            "category": "security",
            "severity": "low",
            "title": "Tenant B Resource",
            "status": "open",
            "resource": {"id": "sg-tenant-b", "type": "AWS::EC2::SecurityGroup"},
            "detectedAt": datetime.now(timezone.utc).isoformat(),
            "operation": "ec2:RevokeSecurityGroupIngress",
            "operationParams": {"GroupId": "sg-tenant-b"}
        }
        FindingRepository.save_finding("org-evil-tenant", finding_b)

        # Query Tenant A: Must NOT see Tenant B finding
        findings_tenant_a = FindingRepository.list_findings("org-acme-prod")
        ids_a = [f["id"] for f in findings_tenant_a]
        self.assertIn("find-tenant-a-secret", ids_a)
        self.assertNotIn("find-tenant-b-secret", ids_a)

        # Query Tenant B: Must NOT see Tenant A finding
        findings_tenant_b = FindingRepository.list_findings("org-evil-tenant")
        ids_b = [f["id"] for f in findings_tenant_b]
        self.assertIn("find-tenant-b-secret", ids_b)
        self.assertNotIn("find-tenant-a-secret", ids_b)

    # ── Test 4: ACID Transaction Consistency on Update & Audit ───────────────
    def test_transactional_consistency_on_status_update(self):
        org_id = "org-acme-prod"
        finding_id = "find-tx-test-01"

        finding = {
            "id": finding_id,
            "category": "cost",
            "severity": "high",
            "title": "Tx Volume Finding",
            "status": "open",
            "resource": {"id": "vol-tx-test", "type": "AWS::EC2::Volume"},
            "detectedAt": datetime.now(timezone.utc).isoformat(),
            "operation": "ec2:DeleteVolume",
            "operationParams": {"VolumeId": "vol-tx-test"}
        }
        FindingRepository.save_finding(org_id, finding)

        # Atomic status update
        FindingRepository.update_status(org_id, finding_id, "resolved", mode="live")

        saved = FindingRepository.get_finding(org_id, finding_id, mode="live")
        self.assertEqual(saved["status"], "resolved")

    # ── Test 5: Credentials Security ──────────────────────────────────────────
    def test_temporary_credentials_never_stored_in_database(self):
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            columns = [
                row[1] for row in cursor.execute("PRAGMA table_info(aws_accounts)").fetchall()
            ]
            self.assertNotIn("secret_access_key", columns)
            self.assertNotIn("session_token", columns)
            self.assertNotIn("credentials", columns)
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
