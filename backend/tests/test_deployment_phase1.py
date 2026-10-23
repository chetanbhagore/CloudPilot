"""Unit and Integration Tests for Phase 1 Deployment Engine.

Validates:
- Polyglot framework detection (FastAPI, Django, Flask, Streamlit, Express, Next.js, Go, Workers)
- Production-grade Dockerfile synthesizer (multi-stage, non-root, healthchecks)
- Port collision manager and dynamic allocator
- REST API router endpoints (/api/v1/workloads/*)
"""

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from app.routers.deployments import (
    ScanRequest,
    SynthesizeRequest,
    allocate_port,
    check_port_status,
    scan_repository,
    synthesize_dockerfile,
)
from app.services.deployment.dockerfile_synth import DockerfileSynthesizer
from app.services.deployment.port_manager import PortManager
from app.services.deployment.repo_scanner import FrameworkType, RepoScanner, ScanResult


class TestDeploymentPhase1(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="test_repo_")
        PortManager.clear_allocations()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)
        PortManager.clear_allocations()

    def test_detect_fastapi(self):
        root = Path(self.test_dir)
        (root / "requirements.txt").write_text("fastapi==0.110.0\nuvicorn==0.28.0\n", encoding="utf-8")
        (root / "main.py").write_text("from fastapi import FastAPI\napp = FastAPI()\n", encoding="utf-8")
        (root / ".env.example").write_text("DATABASE_URL=sqlite:///./test.db\nSECRET_KEY=dev\n", encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertEqual(res.framework, FrameworkType.FASTAPI)
        self.assertEqual(res.language, "python")
        self.assertFalse(res.is_worker)
        self.assertEqual(res.default_port, 8000)
        self.assertEqual(res.entrypoint, "main:app")
        self.assertIn("DATABASE_URL", res.env_vars)
        self.assertIn("SECRET_KEY", res.env_vars)

    def test_detect_streamlit(self):
        root = Path(self.test_dir)
        (root / "requirements.txt").write_text("streamlit>=1.30.0\npandas\n", encoding="utf-8")
        (root / "app.py").write_text("import streamlit as st\nst.write('hello')", encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertEqual(res.framework, FrameworkType.STREAMLIT)
        self.assertEqual(res.default_port, 8501)
        self.assertEqual(res.entrypoint, "app.py")

    def test_detect_django(self):
        root = Path(self.test_dir)
        (root / "manage.py").write_text("#!/usr/bin/env python\n", encoding="utf-8")
        (root / "requirements.txt").write_text("django>=4.2\n", encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertEqual(res.framework, FrameworkType.DJANGO)
        self.assertEqual(res.default_port, 8000)
        self.assertEqual(res.entrypoint, "manage.py")

    def test_detect_flask(self):
        root = Path(self.test_dir)
        (root / "requirements.txt").write_text("flask==3.0.0\n", encoding="utf-8")
        (root / "app.py").write_text("from flask import Flask\napp = Flask(__name__)\n", encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertEqual(res.framework, FrameworkType.FLASK)
        self.assertEqual(res.default_port, 5000)

    def test_detect_express(self):
        root = Path(self.test_dir)
        pkg = {
            "name": "sample-express",
            "dependencies": {"express": "^4.18.2"},
            "main": "server.js"
        }
        (root / "package.json").write_text(json.dumps(pkg), encoding="utf-8")
        (root / "server.js").write_text("const express = require('express');\n", encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertEqual(res.framework, FrameworkType.EXPRESS)
        self.assertEqual(res.language, "nodejs")
        self.assertEqual(res.default_port, 3000)

    def test_detect_nextjs(self):
        root = Path(self.test_dir)
        pkg = {
            "name": "sample-next",
            "dependencies": {"next": "14.1.0", "react": "18.2.0"}
        }
        (root / "package.json").write_text(json.dumps(pkg), encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertEqual(res.framework, FrameworkType.NEXTJS)
        self.assertEqual(res.default_port, 3000)

    def test_detect_react_vite(self):
        root = Path(self.test_dir)
        pkg = {
            "name": "sample-vite",
            "devDependencies": {"vite": "^5.0.0"}
        }
        (root / "package.json").write_text(json.dumps(pkg), encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertEqual(res.framework, FrameworkType.REACT_VITE)
        self.assertEqual(res.default_port, 80)

    def test_detect_go(self):
        root = Path(self.test_dir)
        (root / "go.mod").write_text("module example.com/myapp\ngo 1.22\n", encoding="utf-8")
        (root / "main.go").write_text("package main\nfunc main() {}\n", encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertEqual(res.framework, FrameworkType.GO)
        self.assertEqual(res.language, "go")
        self.assertEqual(res.default_port, 8080)

    def test_detect_worker_service(self):
        root = Path(self.test_dir)
        (root / "requirements.txt").write_text("celery==5.3.6\nredis\n", encoding="utf-8")
        (root / "worker.py").write_text("from celery import Celery\napp = Celery()\n", encoding="utf-8")

        res = RepoScanner.scan_directory(root)
        self.assertTrue(res.is_worker)
        self.assertIsNone(res.default_port)

    def test_dockerfile_synthesizer_fastapi(self):
        scan = ScanResult(
            framework=FrameworkType.FASTAPI,
            language="python",
            is_worker=False,
            default_port=8000,
            entrypoint="app.main:app",
            detected_files=[],
        )
        dockerfile = DockerfileSynthesizer.generate(scan)
        self.assertIn("FROM python:3.11-slim AS builder", dockerfile)
        self.assertIn("USER appuser", dockerfile)
        self.assertIn("EXPOSE 8000", dockerfile)
        self.assertIn("HEALTHCHECK", dockerfile)
        self.assertIn("uvicorn app.main:app", dockerfile)

    def test_dockerfile_synthesizer_worker_no_expose(self):
        scan = ScanResult(
            framework=FrameworkType.PYTHON_GENERIC,
            language="python",
            is_worker=True,
            default_port=None,
            entrypoint="celery -A tasks worker",
            detected_files=[],
        )
        dockerfile = DockerfileSynthesizer.generate(scan)
        self.assertIn("USER appuser", dockerfile)
        self.assertNotIn("EXPOSE", dockerfile)
        self.assertIn("celery -A tasks worker", dockerfile)

    def test_compose_synthesizer(self):
        scan = ScanResult(
            framework=FrameworkType.FASTAPI,
            language="python",
            is_worker=False,
            default_port=8000,
            entrypoint="app.main:app",
            detected_files=[],
        )
        compose = DockerfileSynthesizer.generate_compose("demo-api", scan, host_port=9001)
        self.assertIn("services:", compose)
        self.assertIn("demo-api:", compose)
        self.assertIn("9001:8000", compose)
        self.assertIn("cloudpilot.managed=true", compose)

    def test_port_manager_allocation(self):
        port = PortManager.find_available_port(preferred_port=8912)
        self.assertEqual(port, 8912)
        self.assertTrue(PortManager.is_port_in_use(8912))

        second_port = PortManager.find_available_port(preferred_port=8912, min_port=8913, max_port=8920)
        self.assertNotEqual(second_port, 8912)

        PortManager.release_port(8912)
        self.assertFalse(PortManager.is_port_in_use(8912))

    def test_router_scan_endpoint(self):
        root = Path(self.test_dir)
        (root / "requirements.txt").write_text("fastapi==0.110.0\n", encoding="utf-8")
        (root / "main.py").write_text("from fastapi import FastAPI\napp = FastAPI()\n", encoding="utf-8")

        payload = ScanRequest(local_path=str(root))
        data = scan_repository(payload)
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["scan"]["framework"], "fastapi")
        self.assertEqual(data["scan"]["default_port"], 8000)

    def test_router_synthesize_endpoint(self):
        payload = SynthesizeRequest(
            app_name="billing-service",
            framework="express",
            language="nodejs",
            entrypoint="node server.js",
            is_worker=False,
            default_port=3000,
            custom_port=3005
        )
        data = synthesize_dockerfile(payload)
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["port"], 3005)
        self.assertIn("FROM node:20-alpine", data["dockerfile"])
        self.assertIn("3005:3000", data["docker_compose"])

    def test_router_port_endpoints(self):
        data_check = check_port_status(port=7788)
        self.assertEqual(data_check["port"], 7788)
        self.assertIn("in_use", data_check)

        data_alloc = allocate_port(preferred_port=7788)
        self.assertIn("allocated_port", data_alloc)


if __name__ == "__main__":
    unittest.main()
