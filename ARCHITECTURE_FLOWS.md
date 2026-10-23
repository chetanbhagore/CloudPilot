# CloudPilot Architecture & Scenario Execution Flows

This document details the architectural blueprints, execution flows, and sequence diagrams of **CloudPilot** across core operational scenarios.

---

## 1. High-Level Multi-Cloud System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Presentation Layer (React 19 + TypeScript)"]
        UI_Connect[Cloud Account Connect]
        UI_Findings[Findings & Live Scanner]
        UI_Passport[Safety Passport™ Modal]
        UI_Audit[Cryptographic Audit Trail]
        UI_AI[AI Explainer Drawer]
    end

    subgraph APILayer ["FastAPI Gateway & Security Scoping"]
        AuthRouter[Auth & RBAC Middleware]
        TenantFilter[Tenant Isolation Scoper]
        RateLimiter[Token Bucket Rate Limiter]
        DiscRouter[Discovery Router]
        RemRouter[Remediation Dispatcher]
    end

    subgraph CoreEngine ["CloudPilot Core Engines"]
        AWS_Auth[AWS STS AssumeRole Handshake]
        Azure_Auth[Azure Entra ID OAuth2 Token Cache]
        
        AWS_Discovery[AWS Boto3 Multi-Region Discovery]
        ARM_Discovery[Azure ARM REST Discovery Engine]
        
        PassportGen[Safety Passport™ SHA-256 Engine]
        AIExplainer[Evidence-Grounded AI Explainer]
        
        RemEngine[3-Phase Verified Mutation Engine]
    end

    subgraph PersistenceLayer ["Persistent Storage & Audit Ledger"]
        SQLite_WAL[(SQLite in WAL Mode)]
        Repo_User[User & Tenant Repository]
        Repo_Findings[Finding Repository]
        Repo_Audit[Immutable Audit Repository]
    end

    subgraph CloudProviders ["Live Target Cloud Providers"]
        Target_AWS[Amazon Web Services APIs]
        Target_Azure[Microsoft Azure Resource Manager REST]
    end

    UI_Connect --> AuthRouter
    UI_Findings --> AuthRouter
    UI_Passport --> AuthRouter

    AuthRouter --> RateLimiter --> TenantFilter
    TenantFilter --> DiscRouter
    TenantFilter --> RemRouter

    DiscRouter --> AWS_Auth --> Target_AWS
    DiscRouter --> Azure_Auth --> Target_Azure

    DiscRouter --> AWS_Discovery --> PassportGen
    DiscRouter --> ARM_Discovery --> PassportGen

    RemRouter --> RemEngine
    RemEngine --> Target_AWS
    RemEngine --> Target_Azure

    PassportGen --> AIExplainer
    RemEngine --> Repo_Audit
    DiscRouter --> Repo_Findings
    AuthRouter --> Repo_User
    Repo_Audit --> SQLite_WAL
    Repo_Findings --> SQLite_WAL
    Repo_User --> SQLite_WAL
```

---

## 2. Scenario 1: Multi-Tenant Onboarding & Cross-Account Handshake

How CloudPilot securely establishes trust with customer AWS accounts and Azure subscriptions without sharing long-term master credentials.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Tenant Administrator
    participant UI as CloudPilot UI (/connect)
    participant Backend as FastAPI Accounts Router
    participant AWS_STS as AWS Security Token Service
    participant Entra as Microsoft Entra ID (Azure AD)
    participant ARM as Azure Resource Manager API
    participant DB as SQLite Tenant DB

    alt AWS Account Connection
        Admin->>UI: Input 12-digit AWS Account ID & Role ARN
        UI->>Backend: POST /accounts/connect {account_id, role_arn, external_id}
        Backend->>Backend: Validate Account ID (12 digits) & Role ARN format
        Backend->>AWS_STS: sts:AssumeRole(RoleArn, ExternalId=tenant_guid, Duration=3600)
        AWS_STS-->>Backend: Return Temporary STS Credentials (AccessKey, SecretKey, SessionToken)
        Backend->>AWS_STS: sts:GetCallerIdentity()
        AWS_STS-->>Backend: Confirmed AssumedRole User ARN
        Backend->>DB: Store Connected Account Record (Status=Connected)
        Backend-->>UI: 200 OK {success: true, alias: "123456789012 (ap-south-1)"}
    else Azure Subscription Connection
        Admin->>UI: Input Tenant ID, Client ID, Client Secret, Subscription ID
        UI->>Backend: POST /accounts/connect {cloud_provider: "azure", tenant_id, client_id, ...}
        Backend->>Backend: Sanitize GUIDs (trim, strip braces)
        Backend->>Entra: POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
        Entra-->>Backend: Return Bearer Access Token (JWT, exp=3600s)
        Backend->>Backend: Cache Token in AzureTokenCache (pre-expiration invalidation: 300s)
        Backend->>ARM: GET https://management.azure.com/subscriptions/{id}?api-version=2020-01-01
        ARM-->>Backend: Return Subscription Info {displayName: "Azure for Students", state: "Enabled"}
        Backend->>DB: Store Azure Connected Account Record (Status=Connected)
        Backend-->>UI: 200 OK {success: true, alias: "Azure for Students (sub-xxxx)", is_live: true}
    end
```

---

## 3. Scenario 2: Live Multi-Cloud Discovery & Safety Passport™ Issuance

Continuous evaluation of cloud resources, detection of misconfigurations, and generation of cryptographic Safety Passports.

```mermaid
sequenceDiagram
    autonumber
    actor User as Operator / DevOps
    participant UI as CloudPilot Findings Page
    participant Disc as Discovery Router
    participant AWS as AWS Service APIs (EC2, S3, IAM)
    participant ARM as Azure Resource Manager REST
    participant Passport as Safety Passport Engine
    participant DB as Findings DB

    User->>UI: Click "Run Cloud Scan"
    UI->>Disc: POST /discovery/scan {cloud_provider: "aws" | "azure"}
    
    alt AWS Discovery Scan
        Disc->>AWS: ec2:DescribeSecurityGroups(Filters=[port=22, cidr=0.0.0.0/0])
        Disc->>AWS: ec2:DescribeVolumes(Filters=[status=available])
        Disc->>AWS: ec2:DescribeAddresses(Filters=[association-id=null])
        Disc->>AWS: s3:GetPublicAccessBlock(Buckets)
        AWS-->>Disc: Return Verified Resource Telemetry
    else Azure ARM Discovery Scan
        Disc->>ARM: GET .../providers/Microsoft.Network/networkSecurityGroups?api-version=2023-09-01
        Disc->>ARM: GET .../providers/Microsoft.Compute/disks?api-version=2023-04-02
        Disc->>ARM: GET .../providers/Microsoft.Network/publicIPAddresses?api-version=2023-09-01
        Disc->>ARM: GET .../providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01
        ARM-->>Disc: Return ARM JSON payloads
        Disc->>Disc: Evaluate Rules (AZ-SEC-NSG-001, AZ-COST-DISK-001, AZ-COST-PIP-001, ...)
    end

    loop For Every Discovered Finding
        Disc->>Passport: build_safety_passport(finding, tenant_org_id)
        Passport->>Passport: Compute Canonical Param String ("key1=v1|key2=v2")
        Passport->>Passport: Generate SHA-256 canonical_param_hash
        Passport->>Passport: Check Resource Tags (e.g. Env: Production -> escalate risk to High)
        Passport->>Passport: Generate Immutable SHA-256 passport_hash
        Passport-->>Disc: Return Signed SafetyPassportModel
    end

    Disc->>DB: Upsert Findings & Safety Passports
    Disc-->>UI: 200 OK [List of Verified Findings + Safety Passports]
```

---

## 4. Scenario 3: Human-in-the-Loop 3-Phase Verified Remediation

How CloudPilot executes mutations without risking outages, enforcing atomic execution and independent read-verification.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Authorized Operator (Owner/Admin)
    participant UI as Safety Passport Drawer
    participant Rem as Remediation Router
    participant Guard as Pre-Flight Safety Guard
    participant Cloud as Target Cloud (AWS / Azure)
    participant Audit as Audit Repository

    Admin->>UI: Review Finding, Telemetry & Blast Radius
    Admin->>UI: Click "Approve & Execute Remediation"
    UI->>Rem: POST /discovery/{finding_id}/approve {idempotency_key}

    Note over Rem,Guard: Phase 1: Pre-Flight Safety Verification
    Rem->>Rem: Re-validate Safety Passport SHA-256 Hash
    Rem->>Rem: Check Evidence Freshness (Timestamp < 300s)
    Rem->>Guard: Verify Resource Preconditions
    
    alt Insecure Condition Check (e.g., Azure Public IP)
        Guard->>Cloud: GET Resource State
        Cloud-->>Guard: Return {properties: {ipConfiguration: "nic-01"}}
        Guard-->>Rem: Raise AzureRemediationPreflightError ("IP is active! Blocked.")
        Rem-->>UI: 400 Bad Request (Safety Guard Blocked: Resource In Use)
    else Safe Condition Confirmed (e.g., ipConfiguration is null)
        Guard-->>Rem: Pre-flight Checks Passed
    end

    Note over Rem,Cloud: Phase 2: Live Cloud Provider Mutation
    alt AWS Remediation
        Rem->>Cloud: ec2:RevokeSecurityGroupIngress / ec2:ReleaseAddress
        Cloud-->>Rem: Return 200 OK with aws_request_id
    else Azure Remediation
        Rem->>Cloud: DELETE /subscriptions/.../publicIPAddresses/pip-idle
        Cloud-->>Rem: Return 200/204 with x-ms-request-id
    end

    Note over Rem,Cloud: Phase 3: Independent Read Verification
    Rem->>Cloud: Independent GET Target Resource
    alt Resource Deleted (Success)
        Cloud-->>Rem: Return HTTP 404 (NotFound)
        Rem->>Rem: Mark execution state = "succeeded" (Verified ✓)
    else Resource Still Exists (Failed Mutation)
        Cloud-->>Rem: Return HTTP 200 OK
        Rem->>Rem: Mark execution state = "verification_failed"
    end

    Rem->>Audit: Record Audit Event (actor, req_id, before_state, after_state, SHA-256 hash)
    Rem-->>UI: 200 OK {status: "resolved", verification: "verified", audit_id: "aud-xxx"}
    UI->>Admin: Display Success Card with Verification Evidence & Rollback Command
```

---

## 5. Scenario 4: Evidence-Grounded AI Explanation Engine

Advisory comprehension without hallucinations or write permissions.

```mermaid
flowchart TD
    Trigger([User clicks 'AI Explain' on Finding]) --> Fetch[Fetch Finding Telemetry & Safety Passport]
    Fetch --> FactExtract[1. Extract Deterministic Evidence<br/>• Target Resource ID & Region<br/>• Measured monthly cost waste<br/>• Observed open ingress rules]
    
    FactExtract --> RegistryCheck{2. Check Action Registry}
    RegistryCheck -->|Action in Registry| Supported[Flag: is_action_supported_by_engine = True]
    RegistryCheck -->|Action not registered| Unsupported[Flag: is_action_supported_by_engine = False]
    
    Supported --> RootCause[3. Synthesize Root Cause Analysis<br/>• Plain-English explanation grounded in verified facts]
    Unsupported --> RootCause

    RootCause --> BlastRadius[4. Compute Blast Radius Summary<br/>• Risk of inaction vs. operational risk of remediation]

    BlastRadius --> Limitations[5. Document Boundaries & Uncertainty<br/>• Explicit statement of what tooling cannot inspect]

    Limitations --> RollbackGen[6. Generate Deterministic Rollback CLI<br/>• AWS CLI / Azure CLI command to re-create deleted state]

    RollbackGen --> Assemble[7. Assemble FindingAIExplanation Model]
    Assemble --> Output([Render in Frontend AI Insight Card])
```

---

## 6. Scenario 5: Cryptographic Audit Trail & Chain of Custody

Ensuring compliance evidence cannot be altered, forged, or repudiated.

```mermaid
flowchart LR
    subgraph EventCreation ["Remediation Event Captured"]
        E_ID[Event ID: aud-e7f12a]
        E_Actor[Actor: alice@corp.com]
        E_Action[Action: azure:.../delete]
        E_ReqID[Cloud Request ID: x-ms-req-991]
        E_Time[Timestamp: ISO-8601 UTC]
        E_Before[Before State: TCP 22 OPEN]
        E_After[After State: TCP 22 DELETED]
    end

    subgraph Hasher ["Canonical SHA-256 Integrity Engine"]
        CanonicalString["aud-e7f12a|alice@corp.com|azure:.../delete|x-ms-req-991|2026-10-23T20:00:00Z"]
        SHA[SHA-256 Hash Generator]
        IntegrityHash["Hash: a8f9c4d2...e137b"]
    end

    subgraph Ledger ["Immutable Storage"]
        DB[(SQLite Audit Table)]
    end

    EventCreation --> CanonicalString
    CanonicalString --> SHA --> IntegrityHash
    EventCreation --> DB
    IntegrityHash --> DB

    subgraph AuditorReview ["Auditor Inspection"]
        Query[Auditor Views Event] --> Recompute[Recompute SHA-256 of Canonical String]
        Recompute --> Compare{Matches Stored Hash?}
        Compare -->|Yes| Valid[Verified Untampered ✓]
        Compare -->|No| Tampered[Alert: Audit Log Tampered! ✗]
    end

    DB --> Query
```

---

## 7. Scenario 6: Failure Modes, Rate Limiting & Resilience

How CloudPilot protects itself and customer cloud accounts against API rate limiting and transient failures.

```mermaid
sequenceDiagram
    autonumber
    participant Engine as CloudPilot Service
    participant Res as Resilience Decorator
    participant Cloud as AWS / Azure API

    Engine->>Res: execute_with_resilience(api_call, max_attempts=4)
    Res->>Cloud: API Call Attempt 1
    Cloud-->>Res: HTTP 429 Too Many Requests / RequestLimitExceeded
    Res->>Res: Evaluate Exception (Retryable = True)
    Res->>Res: Exponential Backoff (Sleep 0.5s + jitter)
    
    Res->>Cloud: API Call Attempt 2
    Cloud-->>Res: HTTP 503 Service Unavailable / Transient Error
    Res->>Res: Exponential Backoff (Sleep 1.0s + jitter)
    
    Res->>Cloud: API Call Attempt 3
    Cloud-->>Res: HTTP 200 OK (Payload returned)
    Res-->>Engine: Return Verified Payload
    
    Note over Res,Cloud: Circuit Breaker Protection: If Non-Retryable Error (e.g. 401 Unauthorized / AccessDenied) occurs,<br/>fails immediately without redundant retries.
```
