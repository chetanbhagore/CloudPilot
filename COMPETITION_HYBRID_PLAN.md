# CloudPilot — Competition-Winning Hybrid Implementation Plan
## Real-AWS Core + Existing High-End Frontend (National Level — TECHयुग 2K26)

> **Tagline:** Understand your cloud. Approve the fix. Prove the outcome.  
> **One-Sentence Pitch:** CloudPilot is a safe, human-approved cloud operations platform that identifies real AWS cost leaks and security exposures, explains them with deterministic evidence, displays a transparent Safety Passport™, and mutates cloud infrastructure only after explicit human authorization.  
> **Winning Strategy:** Keep 90%+ of the existing fluid Apple-style frontend. Introduce a minimal FastAPI + `boto3` real AWS backend. Implement a seamless **Mode Switcher** (`Demo Mode` ↔ `Live Mode`). Target the high-impact critical path: **Unattached EBS Volumes** (Cost) and **0.0.0.0/0 SSH Ingress** (Security).

---

## 1. Executive Summary & Strategy Matrix

| Dimension | Competition Requirement | CloudPilot Hybrid Implementation |
| :--- | :--- | :--- |
| **Problem Relevance** | Real cloud pain points for startups/students | Solves accidental runaway bills ($200+ idle GPUs/orphaned EBS) and open port 22 exploits. |
| **Cloud Computing Depth** | Real AWS integration, IAM trust models | Real AWS STS `AssumeRole`, `ExternalId` confused-deputy protection, Two-Role least-privilege architecture. |
| **Safety & Architecture** | Demonstrable guardrails against wild AI | Safety Passport™ with 5 automated pre-flight checks, blast radius bounds, copyable CLI rollback. |
| **Demo Reliability** | Zero risk of live demo failure on stage | **Dual-Mode Engine**: Live Mode executes real AWS calls; Demo Mode serves as instant 0ms fallback. |
| **Human Governance** | High-trust user experience | Intentional friction: confirmation acknowledgment + haptic `SlideToApprove` slider. |

---

## 2. System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend UI                           │
│  (Overview • Discover • Safety Passport • Approve • Audit • Settings)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │     Mode Switcher     │
                        │  Demo Mode ↔ Live Mode│
                        └───────────┬───────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌────────────────────────┐                        ┌────────────────────────┐
│       Demo Mode        │                        │       Live Mode        │
│  (Existing mockData &  │                        │   (FastAPI Backend)    │
│    instant fallback)   │                        │  http://localhost:8000 │
└────────────────────────┘                        └───────────┬────────────┘
                                                              │
                                                  ┌───────────▼────────────┐
                                                  │   boto3 STS Engine     │
                                                  │ AssumeRole(ExternalId) │
                                                  └───────────┬────────────┘
                                                              │
                                            ┌─────────────────┴─────────────────┐
                                            ▼                                   ▼
                                ┌───────────────────────┐           ┌───────────────────────┐
                                │ CloudPilotAuditRole   │           │CloudPilotRemediation  │
                                │ (Role 1: Read-Only)   │           │ (Role 2: Atomic API)  │
                                │ • SecurityAudit       │           │ • RevokeIngress       │
                                │ • ViewOnlyAccess      │           │ • StopInstances       │
                                └───────────────────────┘           └───────────────────────┘
                                            │                                   │
                                            └─────────────────┬─────────────────┘
                                                              ▼
                                                ┌───────────────────────────┐
                                                │ Target / Seeded AWS Acct  │
                                                │  (EC2, EBS, VPC, SG)      │
                                                └───────────────────────────┘
```

---

## 3. The 5-Phase Implementation Blueprint

```mermaid
graph LR
    P1[Phase 1:<br/>Frontend Dual-Mode<br/>& Switcher] --> P2[Phase 2:<br/>FastAPI Backend &<br/>STS AssumeRole]
    P2 --> P3[Phase 3:<br/>Real AWS Discovery<br/>(EBS + Open SSH)]
    P3 --> P4[Phase 4:<br/>Live Passport,<br/>Slide-to-Approve & Diff]
    P4 --> P5[Phase 5:<br/>Competition Pitch,<br/>Demo Script & Viva]
```

---

### Phase 1: Frontend Dual-Mode Engine & State Management

**Objective:** Add seamless mode-switching (`Demo Mode` vs `Live AWS Mode`) while keeping 100% of existing visual components and providing zero-risk presentation fallback.

#### Key Deliverables:
1. **Mode Switcher Component in Navbar:**
   * A pill toggle in [src/components/Navbar.tsx](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/src/components/Navbar.tsx):
     * 🟢 `Demo Mode` (FinTech MVP / ML Sandbox scenarios from mock data).
     * ⚡ `Live AWS Mode` (Real AWS account connected via backend API).
   * Persisted in `localStorage.getItem('cloudpilot_app_mode')`.
2. **Context Adaptation (`DemoContext.tsx`):**
   * Introduce `appMode: 'demo' | 'live'` and `setAppMode(mode)`.
   * Add `apiConnected: boolean` checking backend `/health`.
   * When in Live Mode, `findings` are populated from `http://localhost:8000/findings`.
   * Graceful fallback: If backend or AWS is unreachable, an Apple-style banner appears offering: *"Backend offline — Switched to offline demo fallback"*.
3. **Connect Page Wiring (`src/pages/Connect.tsx`):**
   * New "Live AWS Connection" tab with:
     * AWS Account ID input.
     * Target Region dropdown (`us-east-1`, `ap-south-1`, `eu-west-1`).
     * Role ARN input (`arn:aws:iam::<account>:role/CloudPilotAuditRole`).
     * Generated unique `ExternalId` copy button.
     * "Test & Validate Live Handshake" button that calls `POST /accounts/connect`.

---

### Phase 2: Minimal FastAPI Backend & STS AssumeRole Engine

**Objective:** Build a robust, lightweight Python backend capable of assuming roles via AWS STS using unique external IDs and temporary session credentials.

#### Directory Structure:
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app initialization, CORS, routers
│   ├── config.py            # Environment variables & AWS region defaults
│   ├── database.py          # Lightweight SQLite database with SQLAlchemy
│   ├── models.py            # Account & Finding DB tables
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── routers/
│   │   ├── health.py        # GET /health
│   │   ├── accounts.py      # POST /accounts/connect, GET /accounts
│   │   ├── discovery.py     # POST /discovery/scan
│   │   ├── findings.py      # GET /findings, GET /findings/{id}
│   │   └── remediation.py   # POST /findings/{id}/approve
│   └── services/
│       ├── aws_sts.py       # AssumeRole client with ExternalId & caching
│       ├── aws_discovery.py # boto3 EC2/EBS scanner functions
│       └── normalizer.py    # Maps AWS responses to CloudPilot Finding schema
├── cloudformation/
│   └── cloudpilot-roles.yaml# Two-role CloudFormation template
├── requirements.txt
└── run.py                   # uvicorn runner
```

#### Core CloudFormation Template (`cloudpilot-roles.yaml`):
```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: CloudPilot Isolated Two-Role Architecture (Audit + Remediation)

Parameters:
  OperatorAccountId:
    Type: String
    Default: "123456789012"
    Description: AWS Account ID hosting CloudPilot backend.
  ExternalId:
    Type: String
    Description: Unique tenant ExternalId for confused-deputy protection.

Resources:
  # Role 1: Strictly Read-Only Discovery
  CloudPilotAuditRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: CloudPilotAuditRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              AWS: !Sub "arn:aws:iam::${OperatorAccountId}:root"
            Action: "sts:AssumeRole"
            Condition:
              StringEquals:
                "sts:ExternalId": !Ref ExternalId
      ManagedPolicyArns:
        - "arn:aws:iam::aws:policy/SecurityAudit"
        - "arn:aws:iam::aws:policy/job-function/ViewOnlyAccess"

  # Role 2: Narrow Scoped Remediation (Assumed ONLY on explicit human approval)
  CloudPilotRemediationRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: CloudPilotRemediationRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              AWS: !Sub "arn:aws:iam::${OperatorAccountId}:root"
            Action: "sts:AssumeRole"
            Condition:
              StringEquals:
                "sts:ExternalId": !Ref ExternalId
      Policies:
        - PolicyName: WhitelistedAtomicRemediations
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Effect: Allow
                Action:
                  - "ec2:RevokeSecurityGroupIngress"
                  - "ec2:StopInstances"
                  - "ec2:DescribeSecurityGroups"
                  - "ec2:DescribeInstances"
                  - "ec2:DescribeVolumes"
                Resource: "*"
```

---

### Phase 3: Real AWS Discovery Engine (EBS Waste & Open SSH)

**Objective:** Implement targeted, high-impact `boto3` checks that execute in under 2 seconds and produce concrete, verifiable evidence.

#### Targeted Real Checks:
1. **Unattached EBS Volumes (Cost Leak):**
   * **API Used:** `ec2.describe_volumes(Filters=[{'Name': 'status', 'Values': ['available']}])`
   * **Evidence Collected:** Volume ID, Size in GiB, Volume Type (`gp3`/`gp2`), creation date, tags.
   * **Financial Calculation:** AWS standard pricing formula:
     $$\text{Estimated Monthly Cost} = \text{Size (GiB)} \times \$0.08/\text{month}$$
     (plus simulated ₹ INR currency conversion toggle for local judges).
2. **SSH (Port 22) Open to World `0.0.0.0/0` (Critical Security Exposure):**
   * **API Used:** `ec2.describe_security_groups()`
   * **Evidence Collected:** Security Group ID, Name, Ingress Rule allowing `FromPort=22, ToPort=22, CidrIp='0.0.0.0/0'`.
   * **Attached Resources:** Instances associated with the Security Group.
3. **Stopped / Idle EC2 Instances (Cost & Hygiene):**
   * **API Used:** `ec2.describe_instances(Filters=[{'Name': 'instance-state-name', 'Values': ['stopped']}])`
   * **Evidence Collected:** Instance ID, type, launch time, attached root volumes still accumulating storage charges.

#### Real-to-Frontend Normalizer:
Every real finding is converted directly to the frontend `Finding` schema:
* `id`: deterministic ID (e.g. `live-ebs-vol-0a1b2c3d`)
* `category`: `'cost'` or `'security'`
* `severity`: `'critical'` for open SSH, `'high'` for unattached volumes
* `telemetryData`: Real or synthesized time-series points for the drawer chart
* `preconditions`: Automated checks verifying target resource is still present
* `operation`: `ec2:RevokeSecurityGroupIngress` or `ec2:DeleteVolume` / `ec2:StopInstances`
* `recoveryGuidance`: Real copyable AWS CLI rollback command

---

### Phase 4: Live Safety Passport™, Slide-to-Approve & Verification

**Objective:** Connect the real findings to the interactive Safety Passport and execute verified mutations or safe simulations.

#### Execution Architecture:
1. **Pre-Flight Verification:**
   * Checks whether the resource still exists and matches expected state prior to executing.
2. **Intentional Friction Gate:**
   * Slide-to-Approve slider requires explicit acknowledgment checkbox.
   * Draggable knob with Apple haptic sound engine (`soundEngine.ts`).
3. **Remediation Execution Options:**
   * **Primary Live Action:** `ec2:RevokeSecurityGroupIngress` (safe, completely non-destructive, leaves instance and group intact, only removes the dangerous rule).
   * **Verification Call:** Immediately executes `ec2.describe_security_groups(GroupIds=[sg_id])` to prove port 22 is absent from active ingress permissions.
4. **Cryptographic Proof of Outcome:**
   * Calculates canonical string payload: `${findingId}|${resourceId}|${timestamp}|${requestId}|${userEmail}`
   * Computes SHA-256 integrity hash using native `WebCrypto`.
   * Appends record to immutable audit ledger table.

---

### Phase 5: National Competition Pitch & Viva Readiness

**Objective:** Master the 5–6 minute live pitch, architecture defense, and answers to judging committee technical questions.

#### 5-Minute Competition Demo Script:
1. **Minute 1: The Problem & Vision (Overview Page)**
   * "Cloud computing has a silent crisis: small teams and students are terrified of AWS bills and security vulnerabilities. Existing tools either spam unprioritized alerts or hand over blind write permissions to dangerous AI agents."
   * Show Overview: Security Score at 34%, active spend run-rate.
2. **Minute 2: The Two-Role Trust Architecture (Connect Page)**
   * Open `/connect`.
   * Explain: "CloudPilot never asks for AdministratorAccess. We enforce a strictly decoupled Two-Role IAM model. Role 1 is 100% read-only with a customer-specific ExternalId to prevent Confused Deputy exploits. Role 2 has narrow atomic permissions that can only be assumed upon human approval."
3. **Minute 3: Real Discovery in Live Mode (Discover Page)**
   * Flip the Mode Switcher to **Live AWS Mode**.
   * Hit "Run Deep Scan" $\to$ point out the real unattached EBS volume and port 22 security group pulled live from our AWS test account.
   * Open the **Telemetry Evidence Drawer** to inspect the real resource ARN and probe evidence.
4. **Minute 4: Safety Passport™ & Human Approval (Approve Page)**
   * Advance to `/passport`: "Before touching any cloud resource, CloudPilot generates a digital Safety Passport™ with 5 automated pre-flight checks and a copyable CLI rollback command."
   * Advance to `/approve`: "We implement intentional physical friction: the human operator must check the acknowledgment and drag the Slide-to-Approve slider."
   * Demonstrate the drag gesture $\to$ trigger the 6-stage execution pipeline $\to$ show verified Before vs After state diff.
5. **Minute 5: Cryptographic Proof of Outcome (Audit Page)**
   * Advance to `/audit`: "Execution is not the end — proof is. Every authorized operation generates a canonical payload hashed with SHA-256 for non-repudiation."
   * Open the Attestation Certificate and trigger the signed CSV compliance export.

---

## 4. Judges' Viva Question Bank & Winning Defenses

| Viva Question | High-Scoring Technical Defense |
| :--- | :--- |
| **Q1: Why not let an AI agent auto-fix findings automatically?** | *"Autonomous agents hallucinate AWS CLI commands and lack context on business dependencies. If an AI automatically stops an EC2 machine running a background database sync or removes a security rule during an active deployment, it causes production outages. CloudPilot's philosophy is: **AI explains; human authorizes.**"* |
| **Q2: What is the Confused Deputy problem, and how do you prevent it?** | *"If a multi-tenant platform uses static IAM role ARNs, an attacker could supply another customer's Role ARN and access their infrastructure. We prevent this by enforcing `sts:ExternalId` in the IAM trust policy condition. AWS STS will reject the AssumeRole request unless the unique, unpredictable tenant ID matches."* |
| **Q3: What happens if your backend crashes during a change?** | *"Operations are strictly atomic single-resource API calls (e.g. `ec2:RevokeSecurityGroupIngress`), not long batch scripts. Furthermore, every Safety Passport includes a deterministic rollback CLI command so any engineer can instantly restore previous state directly via AWS CLI without CloudPilot."* |
| **Q4: How do you calculate financial savings without misleading users?** | *"We strictly distinguish between simulated run-rate projections and realized savings. We calculate run-rate impact based on AWS published pricing ($0.08/GB-mo for gp3 EBS), but flag it as a projection until the monthly AWS billing cycle closes."* |
| **Q5: Why did you build a hybrid Demo/Live mode?** | *"Engineering realism. In production, enterprise customers require isolated sandboxes before connecting production accounts. In competition, it demonstrates architectural maturity: a robust real-AWS backend combined with a deterministic, resilient presentation layer that never fails."* |

---

## 5. Execution Roadmap Summary

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Frontend Mode Switcher & Live API Client State                │
│ ├─ Add Demo ↔ Live Mode toggle in Navbar                                │
│ ├─ Update DemoContext to support dynamic live findings & fallback      │
│ └─ Add Live AWS account connection inputs in Connect.tsx               │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Lightweight FastAPI Backend & STS Service                     │
│ ├─ backend/app/main.py with CORS & /health                             │
│ ├─ CloudFormation template (CloudPilotAuditRole + RemediationRole)     │
│ └─ aws_sts.py: AssumeRole with ExternalId verification                 │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Real AWS Discovery Engine                                     │
│ ├─ aws_discovery.py: Unattached EBS volumes (ec2:DescribeVolumes)      │
│ ├─ aws_discovery.py: Open SSH 0.0.0.0/0 (ec2:DescribeSecurityGroups)  │
│ └─ normalizer.py: Map AWS responses to frontend Finding schema         │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Live Safety Passport & Slide-to-Approve Wiring                │
│ ├─ Wire real finding data to PassportView                              │
│ ├─ Wire SlideToApprove execution to backend approve endpoint           │
│ └─ Live Before vs After verified diff generation                       │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Presentation Polish, Demo Script & Rehearsal                  │
│ ├─ Seed test AWS account with real demo mistakes (EBS + SG)            │
│ ├─ 5-minute timed demo walkthrough                                     │
│ └─ Architecture slides & Viva defense rehearsal                        │
└────────────────────────────────────────────────────────────────────────┘
```
