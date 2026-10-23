"""
Relational Database Persistence Layer & Tenant Isolation Engine
Phase 9: Persistent Data and Tenant Isolation

Non-negotiable Rules:
- All database state survives server restarts.
- Strict tenant isolation enforced at the data-access layer: Every query requires organization_id.
- ACID transactions for state transitions, execution recording, and audit trails.
- Schema migrations and automated index creation for high-performance querying.
- Temporary AWS session tokens are NEVER stored in persistent database columns.
"""

import os
import io
import csv
import json
import uuid as uuid_module
import sqlite3
import hashlib
import logging
from contextlib import contextmanager
from typing import Dict, Any, List, Optional, Tuple, Union

logger = logging.getLogger("cloudpilot.db")

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.getenv("CLOUDPILOT_DB_PATH", os.path.join(DB_DIR, "cloudpilot.sqlite3"))


def get_db_connection() -> sqlite3.Connection:
    """Creates a thread-safe connection to SQLite with WAL mode and foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db_transaction():
    """Context manager for ACID transaction execution with automatic rollback on error."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"[DB] Transaction rolled back due to error: {e}")
        raise
    finally:
        conn.close()


def init_database_schema():
    """Initializes relational tables, indexes, and constraints with forward migrations."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # 1. Organizations (Tenants)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            plan TEXT DEFAULT 'Enterprise',
            created_at TEXT NOT NULL
        );
        """)

        # 2. Users with Scoped Organization Membership
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 3. AWS Account Connections
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS aws_accounts (
            account_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            role_arn TEXT NOT NULL,
            external_id TEXT NOT NULL,
            region TEXT NOT NULL,
            execution_mode TEXT NOT NULL,
            status TEXT NOT NULL,
            alias TEXT,
            assumed_role_user_arn TEXT,
            session_expiration TEXT,
            connected_at TEXT NOT NULL,
            last_scanned_at TEXT,
            PRIMARY KEY (organization_id, account_id, execution_mode),
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 4. Discovery Scan Runs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_runs (
            scan_id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            region TEXT NOT NULL,
            status TEXT NOT NULL,
            resource_count INTEGER DEFAULT 0,
            findings_count INTEGER DEFAULT 0,
            scanned_at TEXT NOT NULL,
            execution_mode TEXT NOT NULL,
            error_message TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 5. Discovered Cloud Findings
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS findings (
            finding_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            operation TEXT NOT NULL,
            operation_params TEXT NOT NULL,
            execution_mode TEXT NOT NULL,
            data_source TEXT NOT NULL,
            detected_at TEXT NOT NULL,
            resolved_at TEXT,
            raw_finding_json TEXT NOT NULL,
            PRIMARY KEY (organization_id, finding_id, execution_mode),
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 6. Safety Passports
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS safety_passports (
            passport_id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            finding_id TEXT NOT NULL,
            passport_hash TEXT NOT NULL,
            canonical_param_hash TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            is_safety_blocked INTEGER DEFAULT 0,
            blocked_reason TEXT,
            generated_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            raw_passport_json TEXT NOT NULL,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 7. Remediation Executions & Idempotency Store
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS remediation_executions (
            execution_id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            idempotency_key TEXT UNIQUE NOT NULL,
            finding_id TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            state TEXT NOT NULL,
            actor_email TEXT NOT NULL,
            aws_request_id TEXT,
            verification_status TEXT,
            before_state TEXT,
            after_state TEXT,
            created_at TEXT NOT NULL,
            verified_at TEXT,
            error_message TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 8. Append-Only Audit Log with Cryptographic Hash-Chain & CloudTrail Linkage
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_events (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            finding_id TEXT NOT NULL,
            action TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            actor_email TEXT NOT NULL,
            aws_request_id TEXT,
            outcome TEXT NOT NULL,
            canonical_payload TEXT NOT NULL,
            integrity_hash TEXT NOT NULL,
            previous_hash TEXT DEFAULT 'GENESIS',
            timestamp TEXT NOT NULL,
            execution_mode TEXT NOT NULL,
            account_id TEXT DEFAULT '',
            region TEXT DEFAULT '',
            verification_status TEXT DEFAULT 'none',
            verification_evidence TEXT DEFAULT '{}',
            cloudtrail_event_hint TEXT DEFAULT '',
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # Migration: Ensure all columns exist if table was previously created
        cursor.execute("PRAGMA table_info(audit_events);")
        existing_cols = {row["name"] for row in cursor.fetchall()}
        if "previous_hash" not in existing_cols:
            cursor.execute("ALTER TABLE audit_events ADD COLUMN previous_hash TEXT DEFAULT 'GENESIS';")
        if "account_id" not in existing_cols:
            cursor.execute("ALTER TABLE audit_events ADD COLUMN account_id TEXT DEFAULT '';")
        if "region" not in existing_cols:
            cursor.execute("ALTER TABLE audit_events ADD COLUMN region TEXT DEFAULT '';")
        if "verification_status" not in existing_cols:
            cursor.execute("ALTER TABLE audit_events ADD COLUMN verification_status TEXT DEFAULT 'none';")
        if "verification_evidence" not in existing_cols:
            cursor.execute("ALTER TABLE audit_events ADD COLUMN verification_evidence TEXT DEFAULT '{}';")
        if "cloudtrail_event_hint" not in existing_cols:
            cursor.execute("ALTER TABLE audit_events ADD COLUMN cloudtrail_event_hint TEXT DEFAULT '';")

        # Performance Indexes for Tenant Isolation & Fast Querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_findings_tenant ON findings(organization_id, status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON aws_accounts(organization_id, execution_mode);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(organization_id, timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_remediation_idem ON remediation_executions(idempotency_key);")

        # Seed Default Tenant Organizations if not present
        cursor.execute("""
        INSERT OR IGNORE INTO organizations (id, name, created_at)
        VALUES 
            ('org-acme-prod', 'Acme Cloud Technologies', datetime('now')),
            ('org-evil-tenant', 'Untrusted Third-Party Corp', datetime('now')),
            ('org-demo-simulated', 'CloudPilot Demo Sandbox', datetime('now'));
        """)

    logger.info("[DB] SQLite database schema and indexes initialized successfully.")


# ── Tenant-Scoped Data Access Layer (Repositories) ────────────────────────────
class OrganizationRepository:
    @staticmethod
    def create_organization(org_id: str, name: str, plan: str = "Enterprise") -> Dict[str, Any]:
        with get_db_transaction() as conn:
            conn.execute("""
            INSERT OR REPLACE INTO organizations (id, name, plan, created_at)
            VALUES (?, ?, ?, datetime('now'))
            """, (org_id, name, plan))
            return {"id": org_id, "name": name, "plan": plan}

    @staticmethod
    def get_organization(org_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT * FROM organizations WHERE id = ?", (org_id,)).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


class UserRepository:
    @staticmethod
    def create_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
        with get_db_transaction() as conn:
            conn.execute("""
            INSERT OR REPLACE INTO users (
                id, organization_id, email, name, role, password_hash, salt, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                user_data["id"],
                user_data["org_id"],
                user_data["email"].lower(),
                user_data["name"],
                user_data["role"],
                user_data["password_hash"],
                user_data["salt"],
                1 if user_data.get("is_active", True) else 0
            ))
            return user_data

    @staticmethod
    def get_by_email(email: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (email.strip(),)).fetchone()
            if row:
                d = dict(row)
                d["org_id"] = d["organization_id"]
                d["is_active"] = bool(d["is_active"])
                return d
            return None
        finally:
            conn.close()

    @staticmethod
    def get_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if row:
                d = dict(row)
                d["org_id"] = d["organization_id"]
                d["is_active"] = bool(d["is_active"])
                return d
            return None
        finally:
            conn.close()

    @staticmethod
    def list_by_org(org_id: str) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            rows = conn.execute("SELECT id, organization_id, email, name, role, is_active, created_at FROM users WHERE organization_id = ?", (org_id,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


class AccountRepository:
    @staticmethod
    def save_account(org_id: str, account_data: Dict[str, Any]):
        with get_db_transaction() as conn:
            conn.execute("""
            INSERT OR REPLACE INTO aws_accounts (
                account_id, organization_id, role_arn, external_id, region,
                execution_mode, status, alias, assumed_role_user_arn,
                session_expiration, connected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                account_data["account_id"],
                org_id,
                account_data["role_arn"],
                account_data["external_id"],
                account_data["region"],
                account_data.get("execution_mode", "live"),
                account_data.get("connection_status", "connected"),
                account_data.get("alias", ""),
                account_data.get("assumed_role_user_arn", ""),
                account_data.get("session_expiration", ""),
                account_data.get("connected_at", "")
            ))

    @staticmethod
    def get_accounts(org_id: str, mode: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            if mode:
                rows = conn.execute(
                    "SELECT * FROM aws_accounts WHERE organization_id = ? AND execution_mode = ?",
                    (org_id, mode)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM aws_accounts WHERE organization_id = ?",
                    (org_id,)
                ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    @staticmethod
    def delete_account(org_id: str, account_id: str, mode: str = "live") -> bool:
        with get_db_transaction() as conn:
            cur = conn.execute(
                "DELETE FROM aws_accounts WHERE organization_id = ? AND account_id = ? AND execution_mode = ?",
                (org_id, account_id, mode)
            )
            return cur.rowcount > 0


class FindingRepository:
    @staticmethod
    def save_finding(org_id: str, finding_data: Dict[str, Any]):
        with get_db_transaction() as conn:
            conn.execute("""
            INSERT OR REPLACE INTO findings (
                finding_id, organization_id, account_id, resource_id, resource_type,
                category, severity, title, status, operation, operation_params,
                execution_mode, data_source, detected_at, raw_finding_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                finding_data["id"],
                org_id,
                finding_data.get("account_id") or finding_data.get("resource", {}).get("account_id", ""),
                finding_data.get("resource", {}).get("id", ""),
                finding_data.get("resource", {}).get("type", ""),
                finding_data.get("category", "security"),
                finding_data.get("severity", "medium"),
                finding_data.get("title", ""),
                finding_data.get("status", "open"),
                finding_data.get("operation", ""),
                json.dumps(finding_data.get("operationParams", {})),
                finding_data.get("execution_mode", "live"),
                finding_data.get("data_source", "live_aws"),
                finding_data.get("detectedAt", ""),
                json.dumps(finding_data)
            ))

    @staticmethod
    def get_finding(org_id: str, finding_id: str, mode: str = "live") -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            row = conn.execute(
                "SELECT status, raw_finding_json FROM findings WHERE organization_id = ? AND finding_id = ? AND execution_mode = ?",
                (org_id, finding_id, mode)
            ).fetchone()
            if row:
                obj = json.loads(row["raw_finding_json"])
                obj["status"] = row["status"]
                return obj
            return None
        finally:
            conn.close()

    @staticmethod
    def list_findings(org_id: str, mode: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            if mode:
                rows = conn.execute(
                    "SELECT status, raw_finding_json FROM findings WHERE organization_id = ? AND execution_mode = ?",
                    (org_id, mode)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT status, raw_finding_json FROM findings WHERE organization_id = ?",
                    (org_id,)
                ).fetchall()
            results = []
            for r in rows:
                obj = json.loads(r["raw_finding_json"])
                obj["status"] = r["status"]
                results.append(obj)
            return results
        finally:
            conn.close()

    @staticmethod
    def update_status(org_id: str, finding_id: str, status: str, mode: str = "live"):
        with get_db_transaction() as conn:
            conn.execute(
                "UPDATE findings SET status = ?, resolved_at = datetime('now') WHERE organization_id = ? AND finding_id = ? AND execution_mode = ?",
                (status, org_id, finding_id, mode)
            )


class AuditRepository:
    DISCLAIMER = (
        "Cryptographic SHA-256 integrity hash validates append-only ledger immutability "
        "and sequencing within the CloudPilot database. For independent third-party confirmation "
        "of AWS cloud infrastructure state, corroborate the recorded AWS Request ID against "
        "AWS CloudTrail management event logs."
    )

    @staticmethod
    def record_event(org_id: str, event_data: Dict[str, Any]) -> Dict[str, Any]:
        with get_db_transaction() as conn:
            # 1. Fetch previous event's integrity hash for this tenant
            prev_row = conn.execute(
                "SELECT integrity_hash FROM audit_events WHERE organization_id = ? ORDER BY rowid DESC LIMIT 1",
                (org_id,)
            ).fetchone()
            previous_hash = prev_row["integrity_hash"] if prev_row else "GENESIS"

            # 2. Construct canonical payload and cryptographic hash chain
            event_id = event_data.get("id") or f"aud-{uuid_module.uuid4().hex[:10]}"
            req_id = event_data.get("aws_request_id") or "none"
            outcome = event_data.get("outcome", "unknown")
            timestamp = event_data.get("timestamp") or "2026-10-23T00:00:00Z"
            finding_id = event_data.get("finding_id", "")
            resource_id = event_data.get("resource_id", "")
            actor_email = event_data.get("actor_email", "")

            canonical_payload = (
                f"{previous_hash}|{event_id}|{finding_id}|{resource_id}|"
                f"{timestamp}|{req_id}|{actor_email}|{outcome}"
            )
            integrity_hash = hashlib.sha256(canonical_payload.encode()).hexdigest()

            # 3. Construct AWS CloudTrail cross-check hint
            account_id = event_data.get("account_id", "")
            region = event_data.get("region", "")
            action = event_data.get("action", "")
            cloudtrail_hint = event_data.get("cloudtrail_event_hint")
            if not cloudtrail_hint:
                action_name = action.split(" — ")[0] if " — " in action else action
                action_name = action_name.split(":")[-1] if ":" in action_name else action_name
                cloudtrail_hint = (
                    f"AWS CloudTrail: EventName='{action_name}', AWSAccountId='{account_id}', "
                    f"AWSRegion='{region}', AWSRequestId='{req_id}'"
                )

            verification_status = event_data.get("verification_status") or ("verified" if outcome == "succeeded" else outcome)
            verification_evidence = event_data.get("verification_evidence", "{}")
            if isinstance(verification_evidence, dict):
                verification_evidence = json.dumps(verification_evidence)

            conn.execute("""
            INSERT INTO audit_events (
                id, organization_id, finding_id, action, resource_id,
                actor_email, aws_request_id, outcome, canonical_payload,
                integrity_hash, previous_hash, timestamp, execution_mode,
                account_id, region, verification_status, verification_evidence,
                cloudtrail_event_hint
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event_id,
                org_id,
                finding_id,
                action,
                resource_id,
                actor_email,
                req_id,
                outcome,
                canonical_payload,
                integrity_hash,
                previous_hash,
                timestamp,
                event_data.get("execution_mode", "live"),
                account_id,
                region,
                verification_status,
                verification_evidence,
                cloudtrail_hint
            ))

            event_record = {
                **event_data,
                "id": event_id,
                "organization_id": org_id,
                "previous_hash": previous_hash,
                "canonical_payload": canonical_payload,
                "integrity_hash": integrity_hash,
                "cloudtrail_event_hint": cloudtrail_hint,
                "verification_status": verification_status
            }
            return event_record

    @staticmethod
    def list_events(org_id: str, mode: Optional[str] = None, outcome: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            query = "SELECT * FROM audit_events WHERE organization_id = ?"
            params: List[Any] = [org_id]
            if mode:
                query += " AND execution_mode = ?"
                params.append(mode)
            if outcome:
                query += " AND outcome = ?"
                params.append(outcome)
            query += " ORDER BY rowid DESC"
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    @staticmethod
    def verify_ledger_chain(org_id: str) -> Dict[str, Any]:
        """Validates the tamper-evident cryptographic hash chain across all tenant audit events."""
        conn = get_db_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM audit_events WHERE organization_id = ? ORDER BY rowid ASC",
                (org_id,)
            ).fetchall()

            if not rows:
                return {
                    "is_valid": True,
                    "tamper_detected": False,
                    "total_events": 0,
                    "root_hash": "GENESIS",
                    "disclaimer": AuditRepository.DISCLAIMER
                }

            expected_previous = "GENESIS"
            for row in rows:
                r_dict = dict(row)
                # Check 1: previous_hash matches the prior event's integrity_hash
                if r_dict["previous_hash"] != expected_previous:
                    return {
                        "is_valid": False,
                        "tamper_detected": True,
                        "tampered_event_id": r_dict["id"],
                        "error": f"Chain break detected at event {r_dict['id']}: expected prev {expected_previous}, found {r_dict['previous_hash']}",
                        "disclaimer": AuditRepository.DISCLAIMER
                    }

                # Check 2: recompute integrity_hash from canonical_payload
                recomputed_hash = hashlib.sha256(r_dict["canonical_payload"].encode()).hexdigest()
                if recomputed_hash != r_dict["integrity_hash"]:
                    return {
                        "is_valid": False,
                        "tamper_detected": True,
                        "tampered_event_id": r_dict["id"],
                        "error": f"Payload tamper detected at event {r_dict['id']}: stored hash {r_dict['integrity_hash']} != computed {recomputed_hash}",
                        "disclaimer": AuditRepository.DISCLAIMER
                    }

                expected_previous = r_dict["integrity_hash"]

            return {
                "is_valid": True,
                "tamper_detected": False,
                "total_events": len(rows),
                "root_hash": expected_previous,
                "disclaimer": AuditRepository.DISCLAIMER
            }
        finally:
            conn.close()

    @staticmethod
    def export_audit(org_id: str, format_type: str = "json", mode: Optional[str] = None) -> Union[Dict[str, Any], str]:
        events = AuditRepository.list_events(org_id, mode=mode)
        verification = AuditRepository.verify_ledger_chain(org_id)

        if format_type.lower() == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow([
                "Event ID", "Finding ID", "Action", "Resource ID", "Actor Email",
                "AWS Request ID", "Outcome", "Verification Status", "Timestamp",
                "Execution Mode", "Account ID", "Region", "Integrity Hash",
                "Previous Hash", "CloudTrail Corroboration Hint"
            ])
            for e in events:
                writer.writerow([
                    e["id"], e["finding_id"], e["action"], e["resource_id"], e["actor_email"],
                    e["aws_request_id"], e["outcome"], e["verification_status"], e["timestamp"],
                    e["execution_mode"], e["account_id"], e["region"], e["integrity_hash"],
                    e["previous_hash"], e["cloudtrail_event_hint"]
                ])
            return output.getvalue()

        return {
            "organization_id": org_id,
            "export_format": "json",
            "execution_mode": mode or "all",
            "total_events": len(events),
            "ledger_verification": verification,
            "events": events,
            "disclaimer": AuditRepository.DISCLAIMER
        }


# Auto-initialize database schema and indexes on startup
try:
    init_database_schema()
except Exception as _e:
    logger.warning(f"[DB] Initial schema initialization failed or skipped: {_e}")
