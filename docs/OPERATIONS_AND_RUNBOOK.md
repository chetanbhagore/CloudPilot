# CloudPilot Production Operations & Runbook

This document defines the operational architecture, deployment procedures, backup/recovery runbooks, customer offboarding protocols, and monitoring standards for CloudPilot in commercial production.

---

## 1. Environments & Configuration Separation

CloudPilot enforces strict separation between environments:

| Environment | Purpose | Auth Secret Policy | CORS Policy | Database Storage |
|-------------|---------|-------------------|-------------|------------------|
| **Development** | Local engineering and simulation | Seed development secret allowed | `localhost`, `*` allowed | Local SQLite (`cloudpilot.db`) |
| **Staging** | Pre-production testing & QA | Dedicated staging secret | Restricted domain origins | Persistent staging volume |
| **Production** | Live customer accounts | **Mandatory >= 32 char high-entropy secret**; default rejected | Strict domain origins (`https://app.cloudpilot.io`); wildcard prohibited | Encrypted NVMe volume with WAL checkpointing |

### Environment Startup Verification
On startup, `Settings.validate_production_readiness()` checks that:
1. `CLOUDPILOT_ENV=production` does not use the default fallback secret.
2. The secret is at least 32 characters in length.
3. CORS configuration does not contain wildcards (`*`).
4. SQLite database file directory is accessible and writable.

---

## 2. Production Deployment Procedure

### Prerequisites
- Docker Engine 24+ and Docker Compose v2.20+
- Host with at least 2 vCPUs, 2 GB RAM, and 20 GB encrypted SSD storage.
- AWS IAM Operator credentials configured via AWS IAM Roles for Service Accounts (IRSA) or ECS Task Roles (never hardcoded access keys).

### Deployment Steps
```bash
# 1. Clone repository
git clone https://github.com/chetanbhagore/CloudPilot.git /opt/cloudpilot
cd /opt/cloudpilot

# 2. Configure production environment
cp .env.production.example .env.production
# Generate high entropy secret:
python3 -c "import secrets; print('CLOUDPILOT_AUTH_SECRET=' + secrets.token_urlsafe(32))" >> .env.production

# 3. Build and launch containers
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 4. Verify deployment health
curl -f http://localhost:8000/health/liveness
curl -f http://localhost:8000/health/readiness
```

---

## 3. Database Maintenance, Backup & Recovery

CloudPilot uses SQLite in Write-Ahead Logging (`WAL`) mode with full ACID transaction guarantees and tenant isolation.

### Online Backup (Zero Downtime)
SQLite supports live online backups using the `.backup` command without locking concurrent readers:
```bash
#!/usr/bin/env bash
# /opt/cloudpilot/scripts/backup_db.sh
set -euo pipefail

BACKUP_DIR="/var/backups/cloudpilot"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Perform atomic online snapshot
sqlite3 /app/data/cloudpilot.db ".backup '$BACKUP_DIR/cloudpilot_$TIMESTAMP.db'"

# Compress and upload to encrypted S3 backup bucket
gzip "$BACKUP_DIR/cloudpilot_$TIMESTAMP.db"
aws s3 cp "$BACKUP_DIR/cloudpilot_$TIMESTAMP.db.gz" "s3://cloudpilot-backups-prod/database/$TIMESTAMP.db.gz" --sse aws:kms

# Retain last 30 days locally
find "$BACKUP_DIR" -name "*.db.gz" -mtime +30 -delete
echo "[Backup] Completed at $TIMESTAMP"
```

### Point-in-Time Recovery (PITR)
To restore from backup:
```bash
# 1. Stop backend service
docker compose -f docker-compose.prod.yml stop backend

# 2. Download and decompress backup
aws s3 cp s3://cloudpilot-backups-prod/database/<TIMESTAMP>.db.gz /tmp/restore.db.gz
gzip -d /tmp/restore.db.gz

# 3. Replace database file and set permissions
mv /tmp/restore.db /var/lib/docker/volumes/cloudpilot_cloudpilot-data/_data/cloudpilot.db
chmod 600 /var/lib/docker/volumes/cloudpilot_cloudpilot-data/_data/cloudpilot.db

# 4. Restart backend and verify readiness
docker compose -f docker-compose.prod.yml start backend
curl -f http://localhost:8000/health/readiness
```

---

## 4. Customer Offboarding & AWS Role Revocation

When a customer disconnects an AWS account or offboards from CloudPilot:

### Automated Platform Procedure
1. Call `DELETE /accounts/{account_id}`:
   - Sets account status to `disconnected`.
   - Revokes active sessions from the internal cache.
   - Clears cached credentials immediately.
   - Records an immutable audit log entry: `account:disconnected`.

### Customer AWS Role Revocation Runbook
Provide the following AWS CLI commands to the customer's cloud security team:
```bash
# 1. Delete the CloudPilot cross-account remediation role
aws iam delete-role-policy --role-name CloudPilotRemediationRole --policy-name CloudPilotRemediationExecution
aws iam delete-role --role-name CloudPilotRemediationRole

# 2. Delete the CloudPilot read-only discovery role
aws iam delete-role-policy --role-name CloudPilotAuditRole --policy-name CloudPilotReadOnlyDiscovery
aws iam delete-role --role-name CloudPilotAuditRole

# 3. Verify roles are completely deleted
aws iam get-role --role-name CloudPilotAuditRole 2>&1 | grep "NoSuchEntity"
```

---

## 5. Operational Monitoring & Alerting Standards

The platform should alert on the following operational metrics:

| Metric / Event | Warning Threshold | Critical Threshold | Action Plan |
|----------------|-------------------|-------------------|-------------|
| **AWS API Throttling** | > 5 throttling events / min | > 20 events / min | Check scan concurrency and backoff settings; request AWS service quota increase. |
| **Failed Scans** | 1 failure in a region | >= 3 consecutive scan failures | Check customer trust policy, expired ExternalId, or revoked IAM role. |
| **Stuck Executions** | Execution state in `executing` > 60s | Execution in `executing` > 180s | Trigger automated timeout fail-closed handler; investigate EC2 API latency. |
| **Verification Failures** | 1 verification failure | >= 2 verification failures | Alert security engineer: mutation succeeded on AWS but post-state check failed. |
| **Tampered Audit Ledger** | - | **ANY tamper detection event** (`tamper_detected: true`) | P0 Incident: Database record or hash chain has been altered by unauthorized actor. |
| **Database Readiness** | Response time > 200ms | HTTP 503 response from `/health/readiness` | Check disk I/O, disk space, and SQLite database lock status. |
