import sys
import os
from pathlib import Path

# Ensure backend root is on Python sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if "--test" in sys.argv:
    from app.routers.health import liveness_check, readiness_check
    from fastapi import Response

    print("[TEST] Running CloudPilot backend verification test...")
    h = liveness_check()
    assert h.status == "ok"
    print(f" [OK] Liveness: {h.status} (Uptime: {h.uptime_seconds}s)")

    r = readiness_check(Response())
    assert r.status == "ready"
    print(f" [OK] Readiness: {r.status} (DB: {r.database})")
    print("\n[SUCCESS] CloudPilot backend health and readiness verified with 0 errors!")
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
