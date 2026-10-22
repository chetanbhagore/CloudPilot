# CloudPilot — Safe, Human-Approved Cloud Operations Agent
### National Level Technical Project Competition — TECHयुग 2K26

[![Build Status](https://img.shields.io/badge/Build-Passing-30D158?style=flat-square&logo=vite)](https://github.com/chetanbhagore/CloudPilot)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Checked-0071E3?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Hybrid%20AWS%20Core-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![AWS STS](https://img.shields.io/badge/AWS%20STS-Two--Role%20AssumeRole-FF9900?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/iam/)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

> **Tagline:** *Understand your cloud. Approve the fix. Prove the outcome.*  
> **Pitch:** CloudPilot is a safe, human-approved cloud operations platform that discovers real cost leaks and critical security vulnerabilities in AWS, explains them with deterministic telemetry evidence, shows a transparent **Safety Passport™**, and only acts after **explicit human approval with cryptographic verification**.

---

## 🌟 Key Problem Statement

Small engineering teams, startup founders, and students face two major obstacles in cloud computing:
1. **Unseen Financial Leaks:** Forgotten unattached EBS volumes ($0.08/GB-mo) and stopped EC2 instances quietly incur storage charges month after month.
2. **Public Security Exposures:** Default security groups often leave TCP port 22 (SSH) open to `0.0.0.0/0`, exposing servers to global automated botnets within minutes.

### Why Existing Solutions Fail
* **Enterprise Diagnostic Scanners (Security Hub, Trusted Advisor):** Generate hundreds of noisy, unprioritized alerts without pre-flight checks, blast radius analysis, or safe 1-click execution.
* **Autonomous AI Agents:** Dangerous in production. An AI hallucinating permissions or auto-stopping instances can cause catastrophic downtime.

### CloudPilot's Winning Philosophy
$$\text{AI Explains the Problem} \quad\longrightarrow\quad \text{Safety Passport Discloses Risk} \quad\longrightarrow\quad \text{Human Explicitly Authorizes}$$

---

## 🏛️ System Architecture

```mermaid
graph TD
    User["👨‍💻 Human Platform Engineer"] -->|Slide-to-Approve| UI["🎨 CloudPilot React Frontend (Vite)"]
    
    subgraph "Local Evaluation & Core Engine"
        UI -->|Fetch findings / Status| API["⚡ FastAPI Backend (:8000)"]
        UI -.->|Fail-Safe Fallback| Seed["📦 High-Fidelity Seed Engine"]
    end

    subgraph "Target AWS Cloud Infrastructure"
        API -->|1. AssumeRole (Read-Only) + ExternalId| Role1["🛡️ CloudPilotAuditRole (Describe*)"]
        API -->|2. AssumeRole (Atomic Action)| Role2["🔒 CloudPilotRemediationRole (Revoke/Delete)"]
        Role1 -->|Query VPC & Storage| AWS["☁️ Amazon Web Services (ap-south-1)"]
        Role2 -->|Dispatch Atomic Fix| AWS
    end

    subgraph "Compliance & Audit"
        UI -->|WebCrypto SHA-256| Ledger["📜 Tamper-Evident Ledger"]
        Ledger -->|Download| CSV["📄 Signed Compliance Archive (CSV)"]
    end
```

---

## 🛡️ Core Innovations

### 1. Decoupled Two-Role IAM Architecture
CloudPilot **ingests zero static AWS credentials** (no root keys, no access key IDs). All communication uses temporary AWS STS `AssumeRole` credentials:
* **Role 1 — `CloudPilotAuditRole`:** Strictly read-only (`ec2:Describe*`). Cannot alter or delete any cloud resource.
* **Role 2 — `CloudPilotRemediationRole`:** Least-privilege role with narrowly whitelisted atomic actions (e.g. `ec2:RevokeSecurityGroupIngress`, `ec2:DeleteVolume`). Only assumed during an active, approved change window.
* **Confused Deputy Protection:** Every IAM trust relationship conditions `sts:AssumeRole` on a tenant-specific `sts:ExternalId` (`cp-tenant-9042-demo`), preventing unauthorized cross-account role assumption.

### 2. The Safety Passport™
Every remediation proposal is accompanied by a transparent Safety Passport featuring:
1. **Target Cloud Identity:** Resource ID, ARN, Region, and VPC attachment state.
2. **Exact Atomic Operation:** Complete AWS SDK call parameters with zero wildcards.
3. **5 Automated Pre-Flight Checks:** Validates resource existence, active connections, and SSM Session Manager alternate routes.
4. **Blast Radius Analysis:** Transparent side-effect disclosure.
5. **Deterministic Rollback CLI:** Copyable AWS CLI command to restore previous state immediately.

### 3. Intentional Human Friction
To eliminate accidental clicks, CloudPilot enforces physical human interaction:
* Acknowledgment checkbox verifying blast radius review.
* Physical **Slide-to-Approve** gesture slider (with keyboard <kbd>Enter</kbd> support) inspired by Apple industrial design.
* Dynamic 6-stage execution pipeline providing real-time feedback during AWS API dispatch.

### 4. Cryptographic Proof of Outcome
Every authorized operation is canonicalized into a deterministic payload:
$$\text{Payload} = \text{FindingID} \mid \text{ResourceID} \mid \text{Timestamp} \mid \text{AWSRequestId} \mid \text{AuthorEmail}$$
This payload is digested via native browser `WebCrypto` using **SHA-256**, rendering the audit record tamper-evident and SOC 2 ready.

---

## 🔍 The 3 High-Impact Findings

| Finding ID | Category | Severity | Description | Financial / Security Impact | Remediation Action |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `live-sec-9012-001` | **Security** | `CRITICAL` | TCP port 22 (SSH) open to `0.0.0.0/0` on Security Group `sg-0a1b2c3d4e5f` | 1,700+ probe attacks/24h; botnet vulnerability | `ec2:RevokeSecurityGroupIngress` |
| `live-cost-9012-002` | **Cost** | `HIGH` | 50 GiB gp3 EBS volume (`vol-0918273645a4b3c2`) unattached for 21 days | **$4.00/mo (₹332/mo)** ongoing leak | `ec2:DeleteVolume` |
| `live-cost-9012-003` | **Cost** | `MEDIUM` | Stopped EC2 instance (`i-0d4e5f6a7b8c`) incurring root EBS disk fees for 43 days | **$8.00/mo (₹664/mo)** wasted storage | `ec2:TerminateInstances` |

---

## ⚡ Quick Start Guide

### Prerequisites
* **Node.js** v18+ & **npm**
* **Python** 3.10+ (for FastAPI backend)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/chetanbhagore/CloudPilot.git
cd cloudpilot

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..
```

### 2. Start Both Services (Frontend + Backend)

#### Option A: Quickstart Command (Windows)
Double click `start.bat` or run:
```powershell
.\start.ps1
```

#### Option B: Manual Start (Two Terminals)

**Terminal 1 — FastAPI Backend:**
```bash
python backend/run.py
# Backend runs at http://localhost:8000 (Swagger docs at http://localhost:8000/docs)
```

**Terminal 2 — React Frontend:**
```bash
npm run dev
# Frontend runs at http://localhost:5173
```

---

## 🧪 Testing & Validation

```bash
# 1. Run strict Oxlint linter
npm run lint

# 2. Run TypeScript typecheck & production build
npm run build

# 3. Test backend API endpoints end-to-end
python backend/run.py --test
```

---

## 📂 Project Structure

```
cloudpilot/
├── backend/                       # Python FastAPI Backend
│   ├── app/
│   │   ├── main.py                # FastAPI app & CORS middleware
│   │   ├── config.py              # Environment configuration & port defaults
│   │   ├── schemas.py             # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── health.py          # GET /health
│   │   │   ├── accounts.py        # POST /accounts/connect, GET /accounts
│   │   │   └── discovery.py       # POST /discovery/scan, POST /findings/{id}/approve
│   │   └── services/
│   │       ├── aws_sts.py         # STS AssumeRole engine with ExternalId verification
│   │       └── aws_discovery.py   # boto3 EC2/EBS scanner functions
│   ├── cloudformation/
│   │   └── cloudpilot-roles.yaml  # Isolated Two-Role CloudFormation template
│   ├── requirements.txt           # fastapi, uvicorn, boto3, pydantic
│   └── run.py                     # Backend entrypoint runner
├── src/                           # React 18 + TypeScript Frontend
│   ├── components/                # Reusable Apple-style UI components
│   │   ├── Navbar.tsx             # Navigation & Live Mode switch pill
│   │   ├── PassportView.tsx       # Safety Passport renderer with 6 sections
│   │   ├── SlideToApprove.tsx     # Physical slider component
│   │   └── FindingDetailDrawer.tsx# Telemetry inspection drawer
│   ├── context/                   # Global state management
│   │   ├── DemoContext.tsx        # Hybrid live/demo findings & SHA-256 ledger
│   │   └── AuthContext.tsx        # User identity & role-based access
│   ├── pages/                     # 5 Core Platform Stages
│   │   ├── Overview.tsx           # Cloud health metrics & spend trajectory
│   │   ├── Connect.tsx            # Live AWS STS connection & CloudFormation
│   │   ├── Discover.tsx           # Telemetry investigation & live scan
│   │   ├── PassportPage.tsx       # Safety Passport review
│   │   ├── Approve.tsx            # Slide-to-Approve & 6-stage execution
│   │   ├── AuditTrail.tsx         # Cryptographic ledger & CSV download
│   │   ├── Settings.tsx           # Workspace team management & MFA
│   │   └── Login.tsx              # Enterprise sign-in experience
│   └── data/
│       └── mockData.ts            # Seeded live findings with dual currency ($/₹)
├── DEMO_WALKTHROUGH.md            # 5-minute timed presentation pitch script
├── FRONTEND_DOCUMENTATION.md      # Comprehensive 40KB frontend architecture reference
└── README.md                      # Primary project documentation
```

---

## 🏆 Competition Documentation Links
* **[DEMO_WALKTHROUGH.md](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/DEMO_WALKTHROUGH.md):** 5-minute timed stage pitch script & Judge Viva Defense Q&A cheatsheet.
* **[FRONTEND_DOCUMENTATION.md](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/FRONTEND_DOCUMENTATION.md):** Detailed technical breakdown of UI components, state flowcharts, and Web Audio synthesizer.
* **[COMPETITION_HYBRID_PLAN.md](file:///g:/Chetan/Chetan%20mini%20project/cloudpilot/COMPETITION_HYBRID_PLAN.md):** Complete 5-phase engineering implementation plan.

---

## 👨‍💻 Project Lead
* **Lead Developer:** Chetan Bhagore ([@chetanbhagore](https://github.com/chetanbhagore))
* **Organization:** Acme Cloud Technologies / CloudPilot
* **Event:** National Level Technical Project Competition — TECHयुग 2K26