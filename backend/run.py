import sys
import os
from pathlib import Path

# Ensure backend root is on Python sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if "--test" in sys.argv:
    from app.routers.health import health_check
    from app.routers.accounts import connect_account, list_accounts
    from app.routers.discovery import run_discovery_scan, get_findings, approve_finding
    from app.schemas import AccountConnectRequest, DiscoveryRequest, ApproveRequest

    print("[TEST] Running CloudPilot backend verification test...")
    h = health_check()
    assert h.status == "ok"
    print(f" [OK] Health: {h.status} ({h.mode})")

    acc = connect_account(AccountConnectRequest(
        account_id="123456789012",
        role_arn="arn:aws:iam::123456789012:role/CloudPilotAuditRole",
        external_id="cp-tenant-9042-demo",
        region="ap-south-1"
    ))
    assert acc.success
    print(f" [OK] Account Connect: {acc.account_id} -> {acc.alias}")

    disc = run_discovery_scan(DiscoveryRequest(account_id="123456789012", region="ap-south-1"))
    assert disc.success and len(disc.findings) == 3
    print(f" [OK] Discovery: {len(disc.findings)} findings found")

    appr = approve_finding(disc.findings[0].id, ApproveRequest(user_email="chetan@cloudpilot.io"))
    assert appr.success and len(appr.integrity_hash) == 64
    print(f" [OK] Approve: SHA-256 seal {appr.integrity_hash[:16]}...")
    print("\n[SUCCESS] All backend integration tests passed with 0 errors!")
    sys.exit(0)

import uvicorn
from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )
