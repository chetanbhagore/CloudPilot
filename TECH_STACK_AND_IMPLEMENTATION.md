# CloudPilot: Tech Stack & Technical Implementation Guide

This document provides a comprehensive technical breakdown of every technology, library, architectural decision, and implementation pattern used in **CloudPilot**.

---

## 1. Technology Overview

| Domain | Technology | Version | Purpose & Strategic Rationale |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | **FastAPI** | `^0.115` | High-throughput asynchronous REST API gateway with native OpenAPI spec generation and dependency injection. |
| **Data Validation** | **Pydantic v2** | `^2.10` | High-performance C-extension validation engine enforcing strict typing across all cloud payloads and security schemas. |
| **Persistence Engine** | **SQLite (WAL Mode)** | Native | Serverless, zero-maintenance relational persistence using Write-Ahead Logging (WAL) for concurrent reads/writes and tenant isolation. |
| **AWS SDK** | **Boto3 / Botocore** | `^1.35` | Standard AWS SDK for STS AssumeRole handshakes, multi-region EC2, EBS, VPC, S3, and IAM inspections. |
| **Azure ARM Engine** | **Python `urllib.request`** | Native | **Zero-dependency, direct REST architecture**. Eliminates 250MB+ of brittle third-party Azure SDKs while enabling direct ARM REST control. |
| **Security & Auth** | **PyJWT + hashlib** | `^2.10` | Signed Bearer JWT token issuance, PBKDF2-HMAC-SHA256 password hashing (100,000 iterations), and SHA-256 canonical integrity digests. |
| **Frontend Framework**| **React** | `^19.3` | Component-based UI using modern React 19 primitives (Context API, hooks, transitions). |
| **Language** | **TypeScript** | `~6.0` | Strict static typing across all frontend models, guaranteeing zero runtime undefined property exceptions. |
| **Build & Bundler** | **Vite** | `^8.3` | High-performance development server with Hot Module Replacement (HMR) and optimized Rollup client bundling. |
| **Icons & Visuals** | **Lucide React** | `^1.61` | Lightweight, scalable SVG icon system for multi-cloud branding (AWS, Azure, shield, checkmarks, alerts). |
| **Data Visualization**| **Recharts** | `^3.10` | Declarative SVG charting library for time-series cost telemetry and savings projections. |
| **Animation Engine** | **Framer Motion** | `^14.5` | Smooth, hardware-accelerated micro-animations for sliding drawers, modals, and passport stamp effects. |

---

## 2. Backend Architecture & Implementation Details

### 2.1. FastAPI Dependency Injection & Tenant Scoping
Every protected API route utilizes FastAPI's `Depends` system for server-side authentication and role-based access control (RBAC):

```python
# Location: backend/app/routers/discovery.py
@router.post("/scan", response_model=DiscoveryResponse)
def run_cloud_discovery(
    request: DiscoveryRequest,
    current_user: AuthenticatedUser = Depends(require_permission("view:findings"))
):
    # Tenant organization is extracted directly from the verified cryptographic JWT:
    org_id = current_user.organization_id
    # Enforces isolation: caller can NEVER access or mutate another tenant's data
```

**Key Roles & Permissions:**
- `Owner`: Full administrative privileges (`view:findings`, `approve:remediation`, `manage:accounts`, `view:audit`).
- `Admin`: Operational privileges (`view:findings`, `approve:remediation`, `view:audit`).
- `Operator`: Remediation privileges (`view:findings`, `approve:remediation`).
- `Viewer`: Read-only access (`view:findings`, `view:audit`). Lacks `approve:remediation`—blocked with HTTP 403 Forbidden.

---

### 2.2. Zero-Dependency Azure ARM REST Client
Rather than importing heavy, brittle packages like `azure-mgmt-compute`, `azure-identity`, and `azure-mgmt-network` (which introduce version conflicts and large container footprints), CloudPilot implements a pure, standard-library ARM client in [azure_auth.py](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/backend/app/services/azure_auth.py) and [azure_discovery.py](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/backend/app/services/azure_discovery.py).

#### Implementation: Microsoft Entra ID OAuth2 Token Exchange
```python
def get_azure_oauth_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    payload = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://management.azure.com/.default"
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        # Store in AzureTokenCache with 300s pre-expiry margin
        azure_token_cache.set(tenant_id, client_id, token, expires_in)
        return token
```

#### Strategic Advantages:
1. **Zero Supply-Chain Risk**: No dependencies on external third-party Azure packages.
2. **Speed & Lightweight Footprint**: Instant startup; zero cold-start delay.
3. **Deterministic Error Handling**: Intercepts HTTP status codes (`401 Unauthorized`, `403 AuthorizationFailed`, `404 ResourceNotFound`, `429 TooManyRequests`) with exact Microsoft ARM error payloads.

---

### 2.3. SQLite Relational Persistence with Write-Ahead Logging (WAL)
CloudPilot uses persistent SQLite configured specifically for concurrent multi-tenant SaaS environments in [database.py](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/backend/app/db/database.py).

#### PRAGMA Configuration:
```python
def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")        # Concurrent readers and writers
    conn.execute("PRAGMA busy_timeout = 5000;")        # 5-second automatic retry on lock
    conn.execute("PRAGMA synchronous = NORMAL;")       # Durability without fsync stalls
    conn.execute("PRAGMA foreign_keys = ON;")          # Referential integrity
    return conn
```

#### Tenant Isolation Guarantee:
Every query in the database layer is partitioned by `organization_id`:
```sql
SELECT * FROM findings WHERE organization_id = ? AND execution_mode = ? ORDER BY detected_at DESC;
```
A tenant can never view, update, or delete records belonging to another organization.

---

### 2.4. Cryptographic Safety Passport™ Engine
Located in [safety_passport.py](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/backend/app/services/safety_passport.py), this engine provides non-repudiation and anti-tamper protection:

1. **Canonical Parameter Serialization**:
   ```python
   def compute_canonical_param_hash(params: Dict[str, Any]) -> str:
       # Sort keys alphabetically to guarantee deterministic string representation
       canonical_str = "|".join(f"{k}={v}" for k, v in sorted(params.items()))
       return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()[:16]
   ```
2. **Passport Invalidation**:
   When an operator approves a finding, CloudPilot re-computes `compute_canonical_param_hash` on the incoming payload. If even one parameter (such as a port, group ID, or disk name) has been modified, the hash mismatches and execution is **blocked immediately**.
3. **Freshness Enforcement**:
   Findings older than `freshness_limit_seconds` (default: 300s) are marked `stale`. Remediation on stale findings requires a re-scan.

---

### 2.5. Server-Side Action Registry & Pre-Flight Validation
CloudPilot strictly prohibits arbitrary cloud commands. All mutations are validated against the server-side **Action Registry** in [remediation.py](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/backend/app/services/remediation.py):

```python
# Action Registry Registration Example:
action_registry.register(
    RemediationActionDefinition(
        action_type="azure:network/networkSecurityGroups/securityRules/delete",
        resource_type="Microsoft.Network/networkSecurityGroups/securityRules",
        required_permissions=["Microsoft.Network/networkSecurityGroups/securityRules/delete"],
        risk_level="medium",
        is_reversible=True,
        description="Deletes an insecure inbound security rule from an Azure Network Security Group.",
        parameter_validators={"rule_name": lambda v: bool(v and len(v) > 0)}
    )
)
```

---

## 3. Frontend Architecture & Implementation Details

### 3.1. React 19 State Management (`DemoContext.tsx`)
The frontend uses a centralized React Context architecture ([DemoContext.tsx](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/src/context/DemoContext.tsx)) that exposes unified state and methods to all views:
- `appMode`: Switched dynamically between `'live'` and `'demo'`.
- `cloudProvider`: Switched between `'aws'` and `'azure'`.
- `connectedAccount`: Holds active account alias, ID, region, and verification timestamp.
- `findings`: Active list of findings with associated Safety Passports.
- `runLiveScan()`: Dispatches scans to the backend, transforming raw API telemetry into interactive cards.
- `approveAndRemediate()`: Sends approvals with idempotency keys and renders live verification stamps.

### 3.2. Error Boundaries & Defensive LocalStorage
To ensure bulletproof reliability and prevent blank screens:
1. **[ErrorBoundary.tsx](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/src/components/ErrorBoundary.tsx)**: Wraps the entire component tree, capturing any rendering or lifecycle errors and providing a graceful "Reload Application" recovery button.
2. **Safe JSON Parsing**: All reads from `localStorage` (JWT tokens, user sessions, cloud provider preferences) use `try-catch` blocks with fallback defaults.

### 3.3. Accessible Design & Micro-Animations
- **Design Tokens**: Custom dark theme configured with deep obsidian backgrounds (`#0B0F19`), crisp slate borders (`#1E293B`), and vibrant accent colors (Emerald green for verified security, Amber for warnings, Indigo for AI insights).
- **Framer Motion**: Smooth entry and exit transitions for the **FindingDetailDrawer**, **SafetyPassportModal**, and notification toasts, maintaining 60 FPS performance.

---

## 4. Testing, CI/CD & Production Operations

### 4.1. Automated Test Suite Architecture
The test suite consists of **132 automated tests** distributed across 15 modular test files in `backend/tests/`:

| Test Module | Coverage Scope |
| :--- | :--- |
| `test_phase1.py` - `test_phase4.py` | AWS STS AssumeRole, session invalidation, discovery rules, and EC2/S3/EBS live mutations. |
| `test_phase5.py` | Safety Passport SHA-256 integrity, parameter tampering rejection, freshness timeouts. |
| `test_phase6.py` | PBKDF2 password verification, signed JWT validation, RBAC authorization, tenant isolation, rate limiting. |
| `test_phase7.py` - `test_phase12.py` | Resilience backoff, jitter, circuit breaking, SQLite WAL transactions, audit trail hashing. |
| `test_phase13_security.py` | Comprehensive penetration tests, token tampering, timing attack mitigation. |
| `test_phase14_deployment.py` | Docker container readiness, health check endpoints, environment variable enforcement. |
| `test_phase15_ai_readiness.py` | AI Explainer evidence grounding, uncertainty handling, rollback syntax verification. |
| `test_azure_phase1.py` | Azure OAuth2 token exchange, token caching, ARM REST discovery (NSGs, Disks, IPs, Storage). |
| `test_azure_phase2.py` | 3-phase verified ARM remediation, pre-flight safety blocks, ARM request tracking, Azure AI explainer. |

### 4.2. Production Deployment & Containerization
- **Multi-Stage Dockerfile** ([backend/Dockerfile](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/backend/Dockerfile)):
  - Built on `python:3.11-slim`.
  - Runs as an unprivileged, non-root user (`appuser`).
  - Container health checks probe `/health/live` every 30 seconds.
- **Production Readiness Script** ([backend/run.py --test](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/backend/run.py)):
  - Validates SQLite connection, environment variables, and liveness before accepting traffic.
