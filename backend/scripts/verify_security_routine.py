#!/usr/bin/env python3
"""CloudPilot Security Parameter Verification CLI.

Runs the automated security routine, evaluates all parameters against project expectations,
and prints a formatted terminal audit matrix.
"""

import sys
import os
from pathlib import Path

# Add backend to PYTHONPATH
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.security_routine import run_complete_security_routine


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def main():
    print("=" * 88)
    print(" [SECURITY] CLOUDPILOT AUTOMATED SECURITY PARAMETER VERIFICATION ROUTINE")
    print("=" * 88)

    report = run_complete_security_routine()

    print(f"Evaluated At: {report['evaluated_at']}")
    print(f"Overall Status: {report['status']}")
    print(f"Compliance Score: {report['compliance_score']}% ({report['parameters_matched']}/{report['total_parameters_evaluated']} Matched)")
    print("-" * 88)
    print(f"{'PARAMETER':<32} | {'SEVERITY':<10} | {'STATUS':<10} | {'OBSERVED RESULT'}")
    print("-" * 88)

    for p in report["parameters"]:
        status_symbol = "[MATCHED]" if p["passed"] else "[FAILED]"
        print(f"{p['parameter']:<32} | {p['severity']:<10} | {status_symbol:<10} | {p['observed']}")

    print("=" * 88)

    if report["status"] != "PASS":
        print("[FAIL] SECURITY PARAMETER MISMATCH DETECTED: One or more parameters failed to match project expectations.")
        sys.exit(1)
    else:
        print("[SUCCESS] ALL SECURITY PARAMETERS MATCH PROJECT EXPECTATIONS (100% COMPLIANT).")
        sys.exit(0)


if __name__ == "__main__":
    main()
