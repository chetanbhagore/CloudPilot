#!/usr/bin/env python3
"""
CloudPilot Automated Test Runner
Executes all deterministic test suites across Phases 1 through 13.
Usage:
    python backend/run_tests.py
    python backend/run_tests.py --verbose
"""

import sys
import time
import unittest
from pathlib import Path

def main():
    root_dir = Path(__file__).resolve().parent.parent
    tests_dir = root_dir / "backend" / "tests"

    print("=" * 70)
    print("[RUNNER] CloudPilot Production Test Suite Runner")
    print(f"[PATH] Discovery Directory: {tests_dir}")
    print("=" * 70)

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=str(tests_dir), pattern="test_*.py")

    start_time = time.time()
    verbosity = 2 if "--verbose" in sys.argv or "-v" in sys.argv else 1
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    elapsed = time.time() - start_time

    print("\n" + "=" * 70)
    print("Test Execution Summary:")
    print(f"   Total Tests Run : {result.testsRun}")
    print(f"   Passed          : {result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped)}")
    print(f"   Failures        : {len(result.failures)}")
    print(f"   Errors          : {len(result.errors)}")
    print(f"   Skipped (Opt-In): {len(result.skipped)}")
    print(f"   Execution Time  : {elapsed:.2f}s")
    print("=" * 70)

    if result.wasSuccessful():
        print("[SUCCESS] ALL TESTS PASSED! Ready for production deployment.")
        sys.exit(0)
    else:
        print("[FAILURE] TEST SUITE FAILED. Review failures above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
