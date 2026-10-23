# 🌐 Dummy Project 2: Static Web App & Asset CDN on Azure Blob Storage

> **Estimated Setup Time:** ~10 minutes  
> **Azure Service:** Azure Storage Account (Blob Storage / Static Website, `Standard_LRS`)  
> **Target CloudPilot Rule:** `AZ-SEC-STORAGE-001` (Anonymous Public Blob Access Enabled)  
> **Cloud Category:** Security (Critical Severity)  

---

## 1. Why Azure Storage Account (Serverless Object Storage)?

Unlike Virtual Machines (IaaS compute from Dummy Project 1), Azure Storage Accounts represent serverless PaaS storage. They are used by nearly every modern engineering team to host:
- Static single-page applications (React, Vite, Vue, HTML/CSS).
- Public marketing assets, documentation, and client downloads.
- Application media uploads and document pipelines.

Because Storage Accounts require zero server maintenance and cost pennies per month (< $0.05/mo), developers frequently deploy them without formal security reviews.

---

## 2. Quick 10-Minute Project Code

Create a local directory `portfolio-site/` with two simple files:

### File: `index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cloud Engineering Portfolio</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 80px auto; padding: 20px; line-height: 1.6; }
    h1 { color: #0071e3; }
    .card { background: #f5f5f7; border-radius: 12px; padding: 18px; margin-top: 20px; border: 1px solid #d2d2d7; }
    .badge { background: #34c759; color: white; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <span class="badge">LIVE ON AZURE</span>
  <h1>Cloud Engineering Portfolio</h1>
  <p>Welcome to our cloud infrastructure showcase running on Azure Blob Storage.</p>
  <div class="card">
    <h3>Active Workloads</h3>
    <p>• Python FastAPI Microservice (Azure VM)<br>• Static Frontend CDN (Azure Storage)</p>
  </div>
</body>
</html>
```

### File: `error.html`
```html
<!DOCTYPE html>
<html>
<body>
  <h2>404 - Page Not Found</h2>
  <p>The requested asset does not exist in this storage container.</p>
</body>
</html>
```

---

## 3. Fast Deployment Steps via Azure CLI (or Azure Portal)

### Step 1: Create a Resource Group
```bash
az group create --name rg-cloudpilot-demo2 --location eastus
```

### Step 2: Create a Storage Account
*(Note: Azure storage account names must be between 3 and 24 lowercase alphanumeric characters, globally unique)*
```bash
# Generate a unique storage account name
STORAGE_NAME="stportfoliodemo$RANDOM"
echo "Your storage name: $STORAGE_NAME"

az storage account create \
  --name $STORAGE_NAME \
  --resource-group rg-cloudpilot-demo2 \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2
```

### Step 3: Enable Static Website Hosting
```bash
az storage blob service-properties update \
  --account-name $STORAGE_NAME \
  --static-website \
  --index-document index.html \
  --error-document404-path error.html
```

### Step 4: Upload the HTML Assets
```bash
az storage blob upload-batch \
  --account-name $STORAGE_NAME \
  --source portfolio-site/ \
  --destination '$web'
```

---

## 4. 🚨 The Deliberate "Small Mistake" (Injecting the Vulnerability)

During setup, a developer wants to easily share uploaded PDFs or images with marketing colleagues via direct URLs without having to generate SAS tokens or authenticate with Azure Entra ID.

So they intentionally enable **Anonymous Public Blob Access** on the entire Storage Account:

```bash
# ❌ THE MISTAKE: Explicitly allowing anonymous public blob access on the Storage Account
az storage account update \
  --name $STORAGE_NAME \
  --resource-group rg-cloudpilot-demo2 \
  --allow-blob-public-access true
```

### Why this is a real-world mistake:
- When `allowBlobPublicAccess` is set to `true`, any container created inside this Storage Account can be set to allow anonymous internet users to read or enumerate blobs without a login.
- Over 40% of real-world cloud data leaks occur because an internal bucket or container was created inside an account with public access enabled.
- CIS Azure Foundations Benchmark (Section 3.6) and SOC-2 Type II strictly mandate that `allowBlobPublicAccess` must be set to `false`.

---

## 5. 🔍 How CloudPilot Analyzes & Remediates the Mistake

Once the Storage Account is configured with `allowBlobPublicAccess: true`:

### 1. Connect Azure in CloudPilot
1. Open CloudPilot (`http://localhost:5173`).
2. Navigate to **Connect Cloud Account** (`/connect`).
3. Select **Microsoft Azure (ARM)** and enter your subscription credentials.
4. Click **Connect Azure Subscription**.

### 2. Run the Live Discovery Scan
1. Go to **Discover** (`/discover`).
2. Click **Trigger Live Azure Scan**.
3. CloudPilot’s ARM scanner queries:
   ```
   GET https://management.azure.com/subscriptions/{sub}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01
   ```
4. **CloudPilot immediately flags:**
   - **Finding ID:** `live-az-storage-{STORAGE_NAME}`
   - **Rule Code:** `AZ-SEC-STORAGE-001`
   - **Severity:** `CRITICAL`
   - **Title:** `Azure Storage Account '{STORAGE_NAME}' allows Public Anonymous Blob Access`
   - **Description:** Storage Account has `allowBlobPublicAccess: true`. Containers can permit unauthenticated public access.

### 3. Review the Safety Passport™
Click on the finding card:
- **Target Resource:** Storage Account `Microsoft.Storage/storageAccounts/{STORAGE_NAME}`.
- **Pre-flight Checks:** 5/5 PASSED (Account existence verified, parameter lock valid, rollback instruction generated).
- **Blast Radius:** Scoped exclusively to the single storage account in `rg-cloudpilot-demo2`.
- **Side Effects:** Anonymous blob downloads will be blocked; applications must use SAS tokens or Microsoft Entra ID.

### 4. Slide to Approve Remediation
1. Go to **Approve** (`/approve`).
2. Slide the **Slide to Approve** friction slider.
3. CloudPilot sends an atomic Azure ARM PATCH mutation:
   ```
   PATCH https://management.azure.com/subscriptions/{sub}/resourceGroups/rg-cloudpilot-demo2/providers/Microsoft.Storage/storageAccounts/{STORAGE_NAME}?api-version=2023-01-01
   Body: { "properties": { "allowBlobPublicAccess": false } }
   ```
4. CloudPilot re-queries the ARM API to verify `allowBlobPublicAccess` is now strictly `false`.
5. The action is cryptographically signed and added to CloudPilot's immutable **Audit Ledger** (`/audit`).
