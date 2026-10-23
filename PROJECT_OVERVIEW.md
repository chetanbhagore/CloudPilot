# CloudPilot: Enterprise Multi-Cloud Governance, Security & FinOps Platform

---

## 1. Executive Summary

**CloudPilot** is an enterprise-grade, multi-cloud automated governance and remediation platform designed for modern engineering, DevOps, and security teams managing infrastructure on **Amazon Web Services (AWS)** and **Microsoft Azure**. 

Unlike conventional read-only monitoring dashboards or brittle hackathon scripts, CloudPilot provides an **active, closed-loop control plane**. It couples real-time cloud discovery with **Safety Passport™**—a deterministic, human-in-the-loop cryptographic guardrail system—and an **Evidence-Grounded AI Explanation Engine**. CloudPilot bridges the gap between detecting cloud vulnerabilities or cost leaks and safely remediating them in production with zero downtime.

---

## 2. The Problem Statement

Modern cloud infrastructure suffers from three fundamental structural problems:

### 2.1. The "Alert Fatigue & Inaction" Crisis
Security scanners (CSPMs) generate thousands of alerts weekly. Over 83% of these alerts sit unresolved because:
- Engineering teams lack contextual evidence of *why* the issue occurred.
- Teams fear that executing remediation scripts will inadvertently break production services (the "blast radius" fear).
- Manual remediation requires navigating complex cloud consoles or authoring error-prone CLI commands under pressure.

### 2.2. Unchecked Cost Creep (Zombie Cloud Spend)
Cloud bills continuously inflate due to abandoned or misconfigured infrastructure:
- **Detached block storage**: EBS volumes and Azure Managed Disks detached from decommissioned virtual machines that continue accruing provisioned IOPS and gigabyte fees indefinitely.
- **Idle Public IPv4 addresses**: Cloud providers (both AWS and Azure) charge ~$0.005/hour for unassociated IPv4 addresses. Organizations unknowingly pay hundreds to thousands of dollars monthly for orphan IPs.
- **Over-provisioned compute & legacy generations**: Instances running without utilization monitoring.

### 2.3. The "Black-Box Automation" Dilemma
Existing automated remediation tools either:
- **Overreach (Dangerously Autonomic)**: Blindly execute write mutations without human review, causing high-profile outages when intentional edge-case configurations are wiped out.
- **Simulate without Execution (Faux Demos)**: Present mock animations or synthetic reports without actually integrating with cloud APIs or validating state post-fix.

---

## 3. Target User Personas

| Persona | Core Pain Points | How CloudPilot Solves It |
| :--- | :--- | :--- |
| **Cloud Engineers & DevOps** | Spends 10-15 hours/week investigating security alerts and writing one-off cleanup scripts. | Single-click verified remediation with pre-generated, tested `aws` and `az` rollback commands. |
| **FinOps & Cloud Economists** | High monthly cloud bills with no clear attribution of abandoned resources. | Automated detection of idle Public IPs, detached disks, and unused storage with exact dollar cost projections. |
| **CISOs & SecOps Leads** | Public management ports (SSH 22, RDP 3389) exposed to internet; public S3/Blob storage leaks. | Deterministic rule engine flags exposures in seconds; cryptographically seals every action with SHA-256 audit trails. |
| **Engineering Managers / CTOs** | Needs to enforce compliance (CIS Benchmarks, SOC 2, ISO 27001) without slowing deployment velocity. | Human-in-the-loop approval workflows with strict role-based access control (RBAC) and multi-tenant isolation. |

---

## 4. The CloudPilot Solution Architecture

CloudPilot solves these challenges through a unified, 5-pillar operational framework:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLOUDPILOT PLATFORM                              │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│   1. Real Discovery │  2. Safety Passport │  3. 3-Phase Verified Mutation   │
│   (AWS STS + ARM)   │  (SHA-256 Hashes)   │  (Pre-Check -> Fix -> Verify)   │
├─────────────────────┴─────────────────────┴─────────────────────────────────┤
│   4. Evidence-Grounded AI Explainer       │  5. Tamper-Proof Audit Trail    │
│   (Deterministic Context & Rollback)      │  (Cryptographic Chain-of-Custody│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pillar 1: True Live Multi-Cloud Ingestion (Zero Mocking)
- **AWS Integration**: Connects via AWS STS `AssumeRole` using tenant-isolated `ExternalId` conditions, respecting least-privilege scoping across arbitrary AWS accounts and regions.
- **Azure Integration**: Authenticates against Microsoft Entra ID (Azure AD) via OAuth2 Client Credentials grant, obtaining scoped JSON Web Tokens (JWT) to query Azure Resource Manager (ARM) REST APIs.
- **Zero Third-Party Library Bloat**: Azure communication utilizes Python's standard `urllib.request` engine, eliminating brittle dependencies and vulnerability surfaces.

### Pillar 2: Safety Passport™ Cryptographic Governance
Before any remediation action can be executed, CloudPilot generates a tamper-evident **Safety Passport™**:
1. **Canonical Parameter Hashing**: Action parameters are serialized canonically (`key1=val1|key2=val2`) and hashed using SHA-256. If a malicious actor or network race modifies even a single byte of the parameter payload, execution is blocked immediately.
2. **Freshness Limits**: Telemetry older than 300 seconds is flagged as stale; mutations on stale data are strictly prohibited.
3. **Deterministic Blast Radius**: Evaluates resource tags (e.g., `Env: Production`). Production resources automatically escalate to critical risk requiring Owner approval.

### Pillar 3: 3-Phase Verified Remediation Engine (Fails Closed)
Remediation is never a fire-and-forget API call. Every mutation follows a strict 3-phase lifecycle:
- **Phase 1: Pre-Flight Safety Guard**: Validates that target resources are in a safe-to-mutate state (e.g., verifies a Public IP has `ipConfiguration: null` before deletion, preventing accidental destruction of production network adapters).
- **Phase 2: Live Cloud Mutation**: Issues atomic API calls, capturing cloud provider tracking IDs (`aws_request_id` or `x-ms-request-id`).
- **Phase 3: Independent Read Verification**: Queries the cloud provider via a separate `GET` request. Deletions are only declared successful if the resource returns HTTP 404 (Not Found). Patches are only declared successful if properties reflect the desired state.

### Pillar 4: Evidence-Grounded AI Explanation Engine
Integrates AI strictly for **advisory comprehension**, never granting AI direct write permissions:
- Breaks down complex findings into:
  - **Observed Facts**: Verifiable API telemetry.
  - **Root Cause Analysis**: Human-intelligible explanation of why the finding exists.
  - **Blast Radius Summary**: Inaction risk vs. remediation impact.
  - **Limitations & Disclaimers**: Explicit boundaries of automated tooling.
  - **Deterministic Rollback**: Exact CLI syntax to undo the operation if needed.

### Pillar 5: Tamper-Proof Multi-Tenant Audit Trail
- Stores all tenant actions in persistent SQLite (WAL mode) with tenant isolation.
- Each event is recorded with an immutable canonical SHA-256 integrity hash linking the actor identity, cloud request ID, before/after states, and timestamp.

---

## 5. Supported Multi-Cloud Rules & Actions

### 5.1. Amazon Web Services (AWS)
| Rule Code | Category | Service | Description | Remediation Action |
| :--- | :--- | :--- | :--- | :--- |
| `SEC-SG-001` | Security | EC2 / VPC | Security Group allows inbound SSH (port 22) from `0.0.0.0/0`. | `ec2:RevokeSecurityGroupIngress` |
| `COST-VOL-001` | Cost | EBS | Unattached EBS Volume in `available` state accruing unutilized fees. | `ec2:ModifyVolume` / Snapshot & Delete |
| `COST-EIP-001` | Cost | VPC | Unassociated Elastic IP (EIP) incurring idle IPv4 reservation charges. | `ec2:ReleaseAddress` |
| `SEC-S3-001` | Security | S3 | S3 bucket lacks Block Public Access settings. | `s3:PutPublicAccessBlock` |
| `SEC-IAM-001` | Security | IAM | IAM User Access Key active and older than 90 days. | `iam:UpdateAccessKey` (Deactivate) |

### 5.2. Microsoft Azure
| Rule Code | Category | Service | Description | Remediation Action |
| :--- | :--- | :--- | :--- | :--- |
| `AZ-SEC-NSG-001` | Security | NSG | Inbound SSH (port 22) open to `*` or `Internet`. | `azure:network/networkSecurityGroups/securityRules/delete` |
| `AZ-SEC-NSG-002` | Security | NSG | Inbound RDP (port 3389) open to `*` or `Internet`. | `azure:network/networkSecurityGroups/securityRules/delete` |
| `AZ-COST-DISK-001` | Cost | Disks | Unattached Managed Disk (`managedBy == null`) incurring storage fees. | `azure:compute/disks/delete` |
| `AZ-COST-PIP-001` | Cost | Public IP | Unassociated Public IP (`ipConfiguration == null`) incurring idle IPv4 fees. | `azure:network/publicIPAddresses/delete` |
| `AZ-SEC-STORAGE-001` | Security | Storage | Storage Account configured with `allowBlobPublicAccess: true`. | `azure:storage/storageAccounts/patch` |

---

## 6. How CloudPilot Solves Specific Business Scenarios

### Scenario A: The $50,000 Surprise Cloud Bill
- **The Issue**: An engineering team provisions 50 VMs for a performance test over the weekend, shuts down the VMs on Monday, but leaves their 500GB Premium SSD disks and public IPs intact.
- **The CloudPilot Fix**: Cloud scan immediately flags all unattached disks under `AZ-COST-DISK-001` and idle IPs under `AZ-COST-PIP-001`, calculates projected monthly waste, checks that disks are unattached, and safely purges them upon Owner approval.

### Scenario B: The Internet-Exposed Database Port
- **The Issue**: A developer temporarily opens port 22/3389 on a production Network Security Group to troubleshoot a service, forgetting to revoke it.
- **The CloudPilot Fix**: Flags `AZ-SEC-NSG-001` within seconds. The AI Explainer warns of automated brute-force bots, pre-computes an `az network nsg rule create` rollback command, and with 1 click revokes the rule live via ARM, verifying that a subsequent GET returns HTTP 404.

### Scenario C: SOC 2 & ISO 27001 Audit Readiness
- **The Issue**: Auditors require evidence of continuous access review and proof that no unauthorized changes were made to cloud firewalls.
- **The CloudPilot Fix**: CloudPilot's cryptographic Audit Log records every inspection, passport approval, operator email, ARM/AWS request ID, and canonical SHA-256 hash, generating audit-ready PDF/JSON compliance bundles.
