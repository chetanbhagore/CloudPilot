# 🚀 Dummy Project 1: Python FastAPI Microservice on Azure Virtual Machine

> **Estimated Setup Time:** ~10 minutes  
> **Azure Service:** Azure Virtual Machine (Ubuntu 22.04 LTS, `Standard_B1s`) + Network Security Group (NSG)  
> **Target CloudPilot Rule:** `AZ-SEC-NSG-001` (Inbound Port 22 SSH Open to 0.0.0.0/0)  
> **Cloud Category:** Security (Critical Severity)  

---

## 1. Why Azure Virtual Machine (IaaS)?

An Azure Virtual Machine with a Network Security Group is the most foundational cloud architecture pattern. It is universally available across all Azure subscription tiers (including Azure for Students and Free Tier credits). 

Developers and student teams frequently spin up Ubuntu B1s VMs to host lightweight Python FastAPI or Node.js APIs. However, in the rush to SSH into the machine, engineers almost always make a dangerous security mistake: **opening SSH (port 22) to `*` or `0.0.0.0/0` (the entire public internet)**.

---

## 2. Quick 10-Minute Project Code

Create a local directory `dummy-api/` with two tiny files:

### File: `main.py`
```python
from fastapi import FastAPI

app = FastAPI(title="Dummy Order Service")

@app.get("/")
def read_root():
    return {"status": "online", "service": "order-api", "version": "1.0.0"}

@app.get("/orders")
def get_orders():
    return [
        {"id": 101, "item": "Mechanical Keyboard", "price": 89.99},
        {"id": 102, "item": "USB-C Hub", "price": 29.50}
    ]
```

### File: `requirements.txt`
```text
fastapi>=0.100.0
uvicorn>=0.22.0
```

---

## 3. Fast Deployment Steps via Azure CLI (or Azure Portal)

Open your terminal or Cloud Shell:

### Step 1: Create a Resource Group
```bash
az group create --name rg-cloudpilot-demo1 --location eastus
```

### Step 2: Create a Virtual Machine with a Public IP
```bash
az vm create \
  --resource-group rg-cloudpilot-demo1 \
  --name vm-order-api \
  --image Ubuntu2204 \
  --size Standard_B1s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --nsg nsg-order-api
```

---

## 4. 🚨 The Deliberate "Small Mistake" (Injecting the Vulnerability)

During initial VM configuration, a developer wants to quickly test access from their phone or laptop, so they run:

```bash
# ❌ THE MISTAKE: Adding an inbound rule allowing port 22 from ANY IP address (*)
az network nsg rule create \
  --resource-group rg-cloudpilot-demo1 \
  --nsg-name nsg-order-api \
  --name Allow-SSH-Internet \
  --priority 1000 \
  --protocol Tcp \
  --direction Inbound \
  --access Allow \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges 22
```

### Why this is a real-world mistake:
- Within 15 minutes of an NSG opening port 22 to `*`, automated bots worldwide begin dictionary brute-force attacks against `azureuser`.
- Best practice requires restricting SSH to an explicit corporate VPN CIDR or bastion host, or using Azure Bastion.

---

## 5. 🔍 How CloudPilot Analyzes & Remediates the Mistake

Once the VM is running with this NSG rule, test CloudPilot's multi-cloud governance:

### 1. Connect Azure in CloudPilot
1. Open CloudPilot (`http://localhost:5173`).
2. Go to **Connect Cloud Account** (`/connect`).
3. Select **Microsoft Azure (ARM)**.
4. Input your `Subscription ID`, `Tenant ID`, `Client ID`, and `Client Secret`.
5. Click **Connect Azure Subscription**.

### 2. Run the Live Discovery Scan
1. Navigate to **Discover** (`/discover`).
2. Click **Trigger Live Azure Scan**.
3. CloudPilot’s ARM scanner queries:
   ```
   GET https://management.azure.com/subscriptions/{sub}/providers/Microsoft.Network/networkSecurityGroups?api-version=2023-09-01
   ```
4. **CloudPilot immediately flags:**
   - **Finding ID:** `live-az-nsg-ssh-nsg-order-api`
   - **Rule Code:** `AZ-SEC-NSG-001`
   - **Severity:** `CRITICAL`
   - **Title:** `Inbound SSH (port 22) open to Internet in NSG 'nsg-order-api'`
   - **Description:** Exposes port 22 to public internet (`*`), presenting imminent brute-force risk.

### 3. Review the Safety Passport™
Click on the finding card:
- **Blast Radius:** Single NSG rule `Allow-SSH-Internet` in Resource Group `rg-cloudpilot-demo1`.
- **Pre-flight Checks:** 5/5 PASSED (Resource existence confirmed, parameter lock valid, rollback command generated).
- **Execution TTL:** 60 seconds countdown.

### 4. Slide to Approve Remediation
1. Go to **Approve** (`/approve`).
2. Slide the **Slide to Approve** friction slider.
3. CloudPilot dispatches the atomic Azure mutation:
   ```
   DELETE https://management.azure.com/subscriptions/{sub}/resourceGroups/rg-cloudpilot-demo1/providers/Microsoft.Network/networkSecurityGroups/nsg-order-api/securityRules/Allow-SSH-Internet?api-version=2023-09-01
   ```
4. CloudPilot performs an immediate post-mutation verification call to confirm the rule is absent.
5. The action is permanently recorded in the cryptographic **Audit Ledger** (`/audit`) with the exact Azure ARM timestamp and request tracking.
