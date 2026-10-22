# CloudPilot — Python FastAPI Backend

> **Hybrid Competition Backend:** Real AWS STS `AssumeRole` engine, Two-Role CloudFormation templates, and targeted discovery of unattached EBS volumes and open SSH security groups.

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the server (runs on http://localhost:8000)
python run.py
```

Interactive API Documentation:
* **Swagger UI:** `http://localhost:8000/docs`
* **ReDoc:** `http://localhost:8000/redoc`

---

## 📡 Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health, version, and hybrid status. |
| `POST`| `/accounts/connect` | Validates Role ARN + ExternalId and executes STS AssumeRole. |
| `GET` | `/accounts` | Lists connected AWS accounts. |
| `POST`| `/discovery/scan` | Runs targeted discovery (unattached EBS + port 22 open SSH). |
| `GET` | `/findings` | Returns active findings for the connected account. |
| `GET` | `/findings/{id}` | Returns single finding with Safety Passport specification. |
| `POST`| `/findings/{id}/approve` | Records human approval & generates SHA-256 audit proof. |

---

## 🔒 Two-Role IAM Architecture

* Template location: `cloudformation/cloudpilot-roles.yaml`
* **Role 1 (`CloudPilotAuditRole`):** Attached strictly to `SecurityAudit` and `ViewOnlyAccess`. Requires unique tenant `ExternalId` condition to eliminate Confused Deputy exploits.
* **Role 2 (`CloudPilotRemediationRole`):** Whitelists narrow atomic mutation APIs (`ec2:RevokeSecurityGroupIngress`, `ec2:StopInstances`), assumed *only* upon explicit human authorization.
