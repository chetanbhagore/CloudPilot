# CloudPilot Commercial Viability & Unit Economics Strategy

This analysis defines the commercial target segment, customer operational pain, key SLA metrics, exact cost-to-serve unit economics, and defensible pricing model for CloudPilot as a real, viable SaaS business.

---

## 1. Initial Target Customer Segment & Operational Pain

### Target Ideal Customer Profile (ICP)
- **Profile:** Growth-stage B2B SaaS companies (Series A through Series C).
- **Engineering Headcount:** 30 to 200 software and DevOps engineers.
- **AWS Spend:** $15,000 to $120,000 monthly cloud expenditure across 3 to 20 AWS accounts.
- **Key Buyer:** VP of Engineering, Head of Infrastructure, or Principal Cloud Architect.
- **Key Operator:** DevOps Leads, Platform Engineers, and Security Engineers.

### Validated Operational Pain Points
1. **The "Orphaned Telemetry" Trap:**
   - Security scanning tools (e.g. AWS Security Hub, Prisma Cloud, Wiz) generate hundreds of noisy alerts with no safe execution mechanism.
   - Engineers spend 15–20 hours per week manually triaging alerts in AWS Console.
2. **Fear of Production Outages from Unverified Changes:**
   - Automated remediation scripts (like Lambda janitors) frequently break production by terminating instances or revoking rules without verifying dependencies.
   - CloudPilot's **Safety Passport™** directly solves this by proving zero blast radius *before* approval.
3. **Ghost AWS Cloud Spend:**
   - Detached EBS volumes, unattached Elastic IPs, and obsolete snapshots quietly accumulate thousands of dollars monthly with no audit trail of who created them or whether they are safe to delete.

---

## 2. Core Operational Metrics & Commercial SLAs

CloudPilot monitors and commits to the following operational performance metrics:

| Metric | Target SLA | Commercial Business Impact |
|--------|------------|----------------------------|
| **Scan Reliability** | **99.95%** | Reliable multi-region scans without partial scan fabrication or silent credential failure. |
| **Time to Resolve (TTR)** | **< 3 minutes** | Time from finding detection to verified remediation via 1-slide Safety Passport. Down from 48h manual cycle. |
| **False Positive Rate** | **< 1.5%** | Every finding links to verifiable AWS API evidence (e.g., exact describe CIDR / volume state). Eliminates alert fatigue. |
| **Verified Remediation Rate** | **> 98.0%** | Zero "phantom resolutions." A finding is marked resolved *only* when post-execution AWS describe verification passes. |
| **Realized Savings Verification** | **100% Billing Grounded** | Never claims speculative savings as realized. Only tier 5 savings supported by AWS billing invoices are labeled realized. |

---

## 3. Cost-to-Serve Unit Economics (CloudPilot's Infrastructure Costs)

To establish commercially defensible pricing, CloudPilot's own infrastructure costs per customer account must be modeled accurately.

### Monthly Platform Operating Footprint (100 Connected Customer Accounts)
CloudPilot uses an ultra-lean, secure container architecture running on AWS ECS Fargate or EKS:

| Infrastructure Component | Sizing & Specifications | Total Monthly Cost | Cost Per Connected Account / Mo |
|--------------------------|------------------------|--------------------|---------------------------------|
| **Backend API (ECS Fargate)** | 2 Tasks × 0.5 vCPU, 1 GB RAM (High Availability across 2 AZs) | $32.40 | $0.32 |
| **Frontend CDN & Edge (CloudFront + S3)** | Static SPA bundle + Edge SSL caching | $5.50 | $0.06 |
| **SQLite Persistent Storage (NVMe EFS / EBS)** | 50 GB encrypted SSD storage in WAL mode with Litestream S3 replication | $6.50 | $0.07 |
| **Audit Ledger S3 Archive** | 100 GB S3 Standard-IA with Object Lock (WORM compliance) | $1.50 | $0.02 |
| **AWS Data Transfer Out** | Read-only JSON discovery and verification payloads (~15 GB/mo) | $1.35 | $0.01 |
| **Secrets Manager & KMS** | 2 CMKs + monthly secret rotation calls | $4.00 | $0.04 |
| **Operational Logging (CloudWatch)** | 10 GB ingested structured JSON logs with 30-day retention | $5.70 | $0.06 |
| **Total CloudPilot Compute & Storage** | - | **$56.95 / mo** | **~$0.57 / account / mo** |

### Gross Margin Analysis
At a compute cost of **~$0.57 per customer AWS account per month**, CloudPilot achieves an exceptional **> 92% gross margin** on standard subscription pricing tiers.

---

## 4. Defensible Commercial Pricing Model

Pricing is aligned with customer value (risk eliminated and verifiable cost reduced), avoiding artificial usage metrics:

| Tier | Price | Included Accounts | Core Capabilities | Target Buyer |
|------|-------|-------------------|-------------------|--------------|
| **Starter** | **$199 / mo** | Up to 3 AWS Accounts | Full read-only multi-region discovery, defensible EBS cost engine, automated Safety Passports, standard audit trail (30-day retention). | Seed / Early Series A startups needing instant cloud visibility. |
| **Pro / Team** | **$499 / mo** | Up to 10 AWS Accounts | **Everything in Starter plus:** 1-Click verified remediation vertical slices, server-side RBAC (Viewer, DevOpsLead, Owner), cryptographic hash-chained audit ledger, CloudTrail corroboration export, and 1-year retention. | Series A/B companies with dedicated platform/DevOps teams. |
| **Enterprise** | **$1,499 / mo** | Unlimited Accounts | **Everything in Pro plus:** Dedicated tenant isolation, SSO / SAML integration (Okta, Google Workspace), custom retention rules, SOC 2 Type II audit compliance export, priority 99.95% SLA. | Series B/C growth-stage companies with compliance obligations. |

---

## 5. Commercial Discipline: What CloudPilot Will NOT Do

To maintain product integrity and commercial viability:
1. **No Speculative Savings Billing:** CloudPilot will **never** charge a percentage of "theoretical potential savings." Billing is predictable, flat-rate subscription pricing.
2. **No Multi-Cloud Prematurity:** CloudPilot will dominate AWS security and cost governance before expanding to Azure or GCP.
3. **No Unbounded Destructive Actions:** Write actions will remain strictly reversible, narrowly scoped, and verified against AWS state before expanding the action registry.
