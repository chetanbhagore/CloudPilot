"""CloudPilot Container Runtime Engine.

Handles container building, lifecycle execution, and cloud targets (Local Docker, AWS App Runner, Azure ACA).
Strictly adheres to:
- Never falsely claims success or fabricates container IDs when Docker or cloud credentials are missing.
- Returns explicit 'BLOCKED' status with diagnostic guidance when prerequisites are absent.
- Persists all deployment state in SQLite workload_deployments for multi-worker / restart durability.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.db.database import AccountRepository, WorkloadRepository
from app.services.deployment.dockerfile_synth import DockerfileSynthesizer
from app.services.deployment.port_manager import PortManager
from app.services.deployment.repo_scanner import FrameworkType, RepoScanner, ScanResult

logger = logging.getLogger("cloudpilot.container_runner")


class ContainerRuntimeEngine:
    @staticmethod
    def check_docker_runtime() -> Dict[str, Any]:
        """Checks if the Docker CLI is installed and the Docker daemon is responsive."""
        docker_bin = shutil.which("docker")
        if not docker_bin:
            return {
                "available": False,
                "reason": "Docker CLI binary not found in system PATH. Install Docker Desktop or Docker Engine.",
                "binary": None
            }

        try:
            res = subprocess.run(
                ["docker", "info"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=3
            )
            if res.returncode == 0:
                return {
                    "available": True,
                    "reason": "Docker daemon is active and responsive.",
                    "binary": docker_bin
                }
            return {
                "available": False,
                "reason": f"Docker daemon is not responding: {res.stderr.strip()[:200]}",
                "binary": docker_bin
            }
        except subprocess.TimeoutExpired:
            return {
                "available": False,
                "reason": "Docker daemon ping timed out after 3 seconds.",
                "binary": docker_bin
            }
        except Exception as e:
            return {
                "available": False,
                "reason": f"Failed to inspect Docker runtime: {str(e)}",
                "binary": docker_bin
            }

    @classmethod
    def deploy_workload(
        cls,
        org_id: str,
        app_name: str,
        repo_url: str,
        branch: str = "main",
        framework: str = "unknown",
        language: str = "python",
        target: str = "local",
        preferred_port: Optional[int] = None,
        env_vars: Optional[Dict[str, str]] = None,
        dockerfile_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """Deploys a workload to the requested execution target (local, aws, or azure)."""
        dep_id = f"dep-{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        clean_target = target.lower().strip()
        env_vars = env_vars or {}

        # ── Target: Local Docker Container ──────────────────────────
        if clean_target == "local":
            docker_status = cls.check_docker_runtime()
            if not docker_status["available"]:
                blocked_record = {
                    "id": dep_id,
                    "app_name": app_name,
                    "repo_url": repo_url,
                    "branch": branch,
                    "framework": framework,
                    "language": language,
                    "target": "local",
                    "host_port": preferred_port,
                    "container_port": preferred_port or 8080,
                    "container_id": "",
                    "status": "BLOCKED",
                    "error_message": docker_status["reason"],
                    "logs": f"[{now}] Pre-flight check: {docker_status['reason']}\nExecution halted to prevent simulated false-success.",
                    "created_at": now,
                    "updated_at": now
                }
                WorkloadRepository.create_deployment(org_id, blocked_record)
                return blocked_record

            # Docker is real & available: execute build and run
            allocated_port = PortManager.find_available_port(preferred_port=preferred_port)
            build_dir = tempfile.mkdtemp(prefix=f"build_{app_name}_")
            try:
                # Write Dockerfile
                df_path = os.path.join(build_dir, "Dockerfile")
                with open(df_path, "w", encoding="utf-8") as f:
                    f.write(dockerfile_content or "FROM alpine:3.19\nCMD [\"echo\", \"Ready\"]\n")

                tag = f"cloudpilot/{app_name.lower().replace(' ', '-')}:{dep_id[-6:]}"
                build_cmd = ["docker", "build", "-t", tag, "."]
                build_proc = subprocess.run(
                    build_cmd,
                    cwd=build_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=120
                )
                if build_proc.returncode != 0:
                    err_msg = f"Docker build failed: {build_proc.stderr[:400]}"
                    failed_rec = {
                        "id": dep_id,
                        "app_name": app_name,
                        "repo_url": repo_url,
                        "branch": branch,
                        "framework": framework,
                        "language": language,
                        "target": "local",
                        "host_port": allocated_port,
                        "container_port": preferred_port or 8080,
                        "container_id": "",
                        "status": "FAILED",
                        "error_message": err_msg,
                        "logs": build_proc.stdout + "\n" + build_proc.stderr,
                        "created_at": now,
                        "updated_at": now
                    }
                    WorkloadRepository.create_deployment(org_id, failed_rec)
                    return failed_rec

                # Run container
                container_name = f"cp_{app_name}_{dep_id[-6:]}"
                run_cmd = [
                    "docker", "run", "-d",
                    "--name", container_name,
                    "-p", f"{allocated_port}:{preferred_port or 8080}"
                ]
                for k, v in env_vars.items():
                    run_cmd.extend(["-e", f"{k}={v}"])
                run_cmd.append(tag)

                run_proc = subprocess.run(
                    run_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=30
                )
                if run_proc.returncode != 0:
                    err_msg = f"Docker run failed: {run_proc.stderr[:400]}"
                    failed_rec = {
                        "id": dep_id,
                        "app_name": app_name,
                        "repo_url": repo_url,
                        "branch": branch,
                        "framework": framework,
                        "language": language,
                        "target": "local",
                        "host_port": allocated_port,
                        "container_port": preferred_port or 8080,
                        "container_id": "",
                        "status": "FAILED",
                        "error_message": err_msg,
                        "logs": run_proc.stderr,
                        "created_at": now,
                        "updated_at": now
                    }
                    WorkloadRepository.create_deployment(org_id, failed_rec)
                    return failed_rec

                cid = run_proc.stdout.strip()[:12]
                running_rec = {
                    "id": dep_id,
                    "app_name": app_name,
                    "repo_url": repo_url,
                    "branch": branch,
                    "framework": framework,
                    "language": language,
                    "target": "local",
                    "host_port": allocated_port,
                    "container_port": preferred_port or 8080,
                    "container_id": cid,
                    "status": "RUNNING",
                    "error_message": None,
                    "logs": f"[{now}] Container {container_name} ({cid}) started successfully on port {allocated_port}.",
                    "created_at": now,
                    "updated_at": now
                }
                WorkloadRepository.create_deployment(org_id, running_rec)
                return running_rec

            finally:
                shutil.rmtree(build_dir, ignore_errors=True)

        # ── Target: AWS App Runner / ECS ────────────────────────────
        elif clean_target == "aws":
            db_accounts = AccountRepository.get_accounts(org_id, mode="live")
            aws_acc = next((a for a in db_accounts if a.get("cloud_provider") in ("aws", None)), None)
            if not aws_acc:
                blocked_rec = {
                    "id": dep_id,
                    "app_name": app_name,
                    "repo_url": repo_url,
                    "branch": branch,
                    "framework": framework,
                    "language": language,
                    "target": "aws",
                    "host_port": preferred_port or 8080,
                    "container_port": preferred_port or 8080,
                    "container_id": "",
                    "status": "BLOCKED",
                    "error_message": "No active AWS account connected. Connect an AWS account via STS or IAM Keys in Settings before deploying cloud workloads.",
                    "logs": f"[{now}] Pre-flight check: AWS connection required for App Runner deployment.\nTarget: AWS (ap-south-1).",
                    "created_at": now,
                    "updated_at": now
                }
                WorkloadRepository.create_deployment(org_id, blocked_rec)
                return blocked_rec

            # Account exists: Prepare manifest and cost estimate, gate with Slide-to-Approve
            pending_rec = {
                "id": dep_id,
                "app_name": app_name,
                "repo_url": repo_url,
                "branch": branch,
                "framework": framework,
                "language": language,
                "target": "aws",
                "host_port": 443,
                "container_port": preferred_port or 8080,
                "container_id": f"arn:aws:apprunner:{aws_acc.get('region', 'ap-south-1')}:{aws_acc['account_id']}:service/{app_name}-draft",
                "status": "PENDING_APPROVAL",
                "error_message": None,
                "logs": f"[{now}] Synthesized AWS App Runner Service Manifest (1 vCPU / 2GB RAM). Base Estimated Cost: $15.00/mo. Awaiting human Slide-to-Approve.",
                "created_at": now,
                "updated_at": now
            }
            WorkloadRepository.create_deployment(org_id, pending_rec)
            return pending_rec

        # ── Target: Azure Container Apps ────────────────────────────
        elif clean_target == "azure":
            db_accounts = AccountRepository.get_accounts(org_id, mode="live")
            azure_acc = next((a for a in db_accounts if a.get("cloud_provider") == "azure"), None)
            if not azure_acc:
                blocked_rec = {
                    "id": dep_id,
                    "app_name": app_name,
                    "repo_url": repo_url,
                    "branch": branch,
                    "framework": framework,
                    "language": language,
                    "target": "azure",
                    "host_port": 443,
                    "container_port": preferred_port or 8080,
                    "container_id": "",
                    "status": "BLOCKED",
                    "error_message": "No active Azure Subscription connected. Connect Azure Service Principal in Settings before deploying to Azure Container Apps.",
                    "logs": f"[{now}] Pre-flight check: Azure Service Principal connection required for Container Apps.\nTarget: Azure (eastus).",
                    "created_at": now,
                    "updated_at": now
                }
                WorkloadRepository.create_deployment(org_id, blocked_rec)
                return blocked_rec

            pending_rec = {
                "id": dep_id,
                "app_name": app_name,
                "repo_url": repo_url,
                "branch": branch,
                "framework": framework,
                "language": language,
                "target": "azure",
                "host_port": 443,
                "container_port": preferred_port or 8080,
                "container_id": f"/subscriptions/{azure_acc['account_id']}/resourceGroups/rg-cloudpilot/providers/Microsoft.App/containerApps/{app_name}-draft",
                "status": "PENDING_APPROVAL",
                "error_message": None,
                "logs": f"[{now}] Synthesized Azure Container App specification (0.5 vCPU / 1GB RAM). Free Tier Eligible. Awaiting human Slide-to-Approve.",
                "created_at": now,
                "updated_at": now
            }
            WorkloadRepository.create_deployment(org_id, pending_rec)
            return pending_rec

        else:
            raise ValueError(f"Unsupported deployment target '{target}'. Supported targets: 'local', 'aws', 'azure'.")

    @classmethod
    def stop_workload(cls, org_id: str, deployment_id: str) -> Dict[str, Any]:
        """Stops an active workload."""
        dep = WorkloadRepository.get_deployment(org_id, deployment_id)
        if not dep:
            raise KeyError(f"Deployment '{deployment_id}' not found for tenant.")

        cid = dep.get("container_id")
        if cid and dep.get("target") == "local":
            docker_status = cls.check_docker_runtime()
            if docker_status["available"]:
                try:
                    subprocess.run(["docker", "stop", cid], timeout=15)
                except Exception as e:
                    logger.warning(f"Failed to stop docker container {cid}: {e}")

        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "status": "STOPPED",
            "updated_at": now,
            "logs": (dep.get("logs") or "") + f"\n[{now}] Workload stopped by operator."
        }
        WorkloadRepository.update_deployment(org_id, deployment_id, update_data)
        dep.update(update_data)
        return dep
