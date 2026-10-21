# CloudPilot — Current Status & Implementation Progress

> **Last Updated:** October 21, 2026  
> **Repository:** [github.com/chetanbhagore/CloudPilot](https://github.com/chetanbhagore/CloudPilot)  
> **Latest Git Commit:** `a4ac10a`  
> **Local Dev Server:** `http://localhost:5173/` (Active & Tested)

---

## 1. Executive Status & Build Health

| Metric | Status | Details |
| :--- | :---: | :--- |
| **TypeScript / Bundler** | ✅ **Passing** | Vite 8.3.5 + React 19.3.1 + TypeScript 6.0.3 (`tsc -b && vite build` built in 6.14s). |
| **Linter (Oxlint)** | ✅ **Passing** | `0 errors, 0 warnings` across 22 files with 116 strict rules. |
| **GitHub Remote** | ✅ **In Sync** | Branch `main` is up-to-date with `origin/main`. |
| **Local Development** | ✅ **Running** | Live on `http://localhost:5173/` with Hot Module Replacement (HMR). |

---

## 2. What Has Been Achieved (Current Capabilities)

CloudPilot currently functions as an **end-to-end interactive frontend product prototype** designed for competition pitches, recorded demo videos, and user walkthroughs.

### 2.1 The Complete 5-Stage Demo Storyline
1. **Stage 1 — Connect Account (`/connect`):**
   * **Dynamic Scenario Switching:** Choose between *"Early-Stage FinTech Startup (MVP)"* (Mumbai region, port 22 open, unattached gp3 EBS) and *"Student ML Research Sandbox"* (N. Virginia region, idle NVIDIA V100 GPU instance incurring $2,203/mo, open Jupyter port 8888).
   * **Two-Role IAM Model Display:** Interactive tabs displaying the read-only CloudFormation discovery template (`SecurityAudit` + `ViewOnlyAccess`) versus the narrowly scoped atomic remediation template.
   * **Simulated STS AssumeRole:** 1.8-second simulated authentication handshake with external ID validation before navigating to discovery.
2. **Stage 2 — Discover Findings (`/discover`):**
   * **Resource Telemetry Radar:** Scans 47 active AWS resources with live status banners.
   * **Category Filters:** Real-time client-side filtering between *"All Findings"*, *"Security Exposures"*, and *"Cost Opportunities"*.
   * **Slide-Over Evidence Drawer (`FindingDetailDrawer.tsx`):**
     * Interactive historical telemetry curve rendered with Recharts.
     * Cites deterministic proof points (e.g. 1,679 automated intrusion attempts, zero IOPS over 23 days).
     * Includes accessibility keyboard listener (<kbd>Esc</kbd> closes drawer).
3. **Stage 3 — The Safety Passport™ (`/passport`):**
   * **Dynamic Document Generation:** Generates a tailored passport card for the active finding (e.g. `ec2:RevokeSecurityGroupIngress` for FinTech vs `ec2:StopInstances` for Student GPU).
   * **5 Automated Pre-Flight Checks:** Validates target presence, rule presence, role permissions, dependency state, and non-default group status.
   * **Side Effects & Reversible CLI Rollback:** Explicit blast radius disclosure and copyable rollback command (`aws ec2 authorize-security-group-ingress...` or `aws ec2 start-instances...`).
4. **Stage 4 — Human-in-the-Loop Authorization (`/approve`):**
   * **Intentional Friction:** Checkbox requiring explicit acknowledgment that zero active connections will be severed.
   * **Physical Slide-to-Approve Slider:** Spring-physics slider with magnetic snap-back below 82% threshold and tactile latch.
   * **Keyboard Accessible Slider:** Supports <kbd>Enter</kbd>, <kbd>Space</kbd>, or <kbd>→</kbd> for screen-reader and keyboard-only users.
   * **Real-Time Streaming Terminal:** Live 380ms step-by-step log output simulating AWS STS assumption, API dispatch, describe-verification, and score recalculation.
   * **Verified State Diff:** Live Before-vs-After comparison proving rule removal or instance state transformation.
5. **Stage 5 — Immutable Audit Ledger & Proof (`/audit`):**
   * **Real CSV Export:** Clicking *"Export Audit CSV"* downloads a genuine `.csv` file via browser `Blob` with full audit metadata.
   * **Native WebCrypto SHA-256 Ledger Hash:** Generates authentic cryptographic hashes derived from the audit ID, timestamp, and target resource.
   * **Printable Attestation Certificate:** Modal with gold seal and attestation details triggering native `window.print()`.

---

## 3. Core Architecture & System Additions

### 3.1 Unified State Management (`src/context/DemoContext.tsx`)
* Created a centralized `DemoProvider` wrapping the entire application.
* **Reactive Data Sync:** Authorizing remediation in `/approve` actively changes the finding status to `RESOLVED ✓` in `/discover`, shifts the Security Score from `34%` → `72%` (+38 pts) in `/`, and pushes a live record into `/audit`.
* **State Reset:** Clicking *"Reset Demo"* cleanly restores initial un-remediated states across all views.

### 3.2 Synthesized Web Audio Engine (`src/utils/soundEngine.ts`)
* Zero-dependency Web Audio API oscillator synthesis.
* Produces soft tactile clicks for button presses, slider snaps, and an Apple-inspired two-harmonic major chord chime upon authorization.
* Includes a global mute/unmute toggle in the header persisted to `localStorage`.

### 3.3 Mobile & Tablet Responsiveness (`src/index.css`)
* Added media queries for `@media (max-width: 900px)` and `@media (max-width: 600px)`.
* Desktop sidebar transforms into a compact, responsive navigation bar on mobile viewports.
* Metric grids automatically adapt from 4 columns to 2 columns on tablet and 1 column on mobile.
* Adjusted muted typography colors to achieve strict WCAG AA contrast compliance (> 4.5:1).

### 3.4 Presenter Pitch HUD (`src/components/PitchHud.tsx`)
* Floating HUD docked in the bottom-right corner.
* Dynamically displays tailored slide talking points, problem/solution framing, and quotes for each route during recorded video demonstrations.

---

## 4. Current Limitations & Scope Boundary

To maintain complete transparency:

| Feature Area | Current Prototype Capability | Production Backend Requirement (Future) |
| :--- | :--- | :--- |
| **AWS API Execution** | Simulated via realistic terminal logging and state diffs. | AWS SDK v3 (`@aws-sdk/client-ec2`) calling real AWS endpoints. |
| **Discovery Scanning** | Pre-configured realistic datasets (FinTech & Student). | Scheduled CloudWatch metric polling & CloudTrail event ingesters. |
| **Audit Ledger Storage** | Persisted in memory and exportable to CSV/Print. | Append-only database (Amazon QLDB, DynamoDB, or PostgreSQL) with KMS signing. |
| **Multi-Tenancy** | Single-session local sandbox. | Cognito/Auth0 authentication with isolated tenant schemas. |

---

## 5. Next Milestones & Future Roadmap

### Phase B — Pre-Launch Polish & Hardening
- [ ] Add lightweight local persistence via `localStorage` so page refreshes retain remediation history.
- [ ] Add animated resource topology graph (interactive visual node map of VPC, EC2, and S3).
- [ ] Add a third scenario preset: *"Enterprise Multi-Account Org (AWS Control Tower)"*.

### Phase C — Production Backend Integration
- [ ] Implement Node.js / Go backend microservice with AWS SDK v3.
- [ ] Real `sts:AssumeRole` verification pipeline with customer AWS Account IDs.
- [ ] Automated recurring drift-detection crons.
- [ ] Slack & Discord webhook dispatch when a new Safety Passport is ready for review.
