"""CloudPilot Workload & Deployment API Router.

Provides endpoints for:
- Repository scanning & framework detection
- Automated Dockerfile and Compose synthesis
- Port collision checks and dynamic allocation
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.services.deployment.dockerfile_synth import DockerfileSynthesizer
from app.services.deployment.port_manager import PortManager
from app.services.deployment.repo_scanner import FrameworkType, RepoScanner, ScanResult

router = APIRouter(prefix="/api/v1/workloads", tags=["Workloads & Deployments"])


class ScanRequest(BaseModel):
    repo_url: Optional[str] = Field(None, description="Public Git repository URL to clone and scan")
    local_path: Optional[str] = Field(None, description="Local folder path to scan directly")
    branch: Optional[str] = Field("main", description="Git branch to clone")


class SynthesizeRequest(BaseModel):
    app_name: str = Field(default="app", description="Identifier name for the application")
    framework: str = Field(..., description="Framework identifier (e.g. fastapi, django, express)")
    language: str = Field(default="python", description="Language of the workload")
    entrypoint: str = Field(default="", description="Application entrypoint or start command")
    is_worker: bool = Field(default=False, description="Whether the workload is a background worker")
    default_port: Optional[int] = Field(default=8080, description="Container port")
    custom_port: Optional[int] = Field(default=None, description="Optional custom port override")


@router.post("/scan", response_model=Dict[str, Any])
def scan_repository(payload: ScanRequest):
    """Scans a repository (local path or git url) and determines the framework, port, and entrypoint."""
    if not payload.local_path and not payload.repo_url:
        # Default scan current project directory
        current_dir = os.getcwd()
        try:
            result = RepoScanner.scan_directory(current_dir)
            return {"status": "ok", "scan": result.to_dict()}
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if payload.local_path:
        if not os.path.isdir(payload.local_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Directory not found: {payload.local_path}")
        try:
            result = RepoScanner.scan_directory(payload.local_path)
            return {"status": "ok", "scan": result.to_dict()}
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    # Git URL clone shallowly
    temp_dir = tempfile.mkdtemp(prefix="cloudpilot_repo_")
    try:
        cmd = ["git", "clone", "--depth", "1"]
        if payload.branch:
            cmd.extend(["-b", payload.branch])
        cmd.extend([payload.repo_url, temp_dir])

        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        result = RepoScanner.scan_directory(temp_dir)
        return {"status": "ok", "scan": result.to_dict()}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_408_REQUEST_TIMEOUT, detail="Git clone operation timed out after 30 seconds.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to scan repository: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/synthesize", response_model=Dict[str, Any])
def synthesize_dockerfile(payload: SynthesizeRequest):
    """Generates a production-ready Dockerfile and docker-compose.yml for the workload."""
    try:
        framework_enum = FrameworkType(payload.framework.lower())
    except ValueError:
        framework_enum = FrameworkType.UNKNOWN

    scan = ScanResult(
        framework=framework_enum,
        language=payload.language,
        is_worker=payload.is_worker,
        default_port=payload.default_port,
        entrypoint=payload.entrypoint,
        detected_files=[],
    )

    port = payload.custom_port or payload.default_port or 8080
    dockerfile_content = DockerfileSynthesizer.generate(scan, custom_port=port)
    compose_content = DockerfileSynthesizer.generate_compose(payload.app_name, scan, host_port=port)

    return {
        "status": "ok",
        "app_name": payload.app_name,
        "framework": payload.framework,
        "port": port,
        "is_worker": payload.is_worker,
        "dockerfile": dockerfile_content,
        "docker_compose": compose_content,
    }


@router.get("/ports/check", response_model=Dict[str, Any])
def check_port_status(port: int = Query(..., ge=1, le=65535, description="Port number to inspect")):
    """Checks whether a specific host port is already bound or free."""
    in_use = PortManager.is_port_in_use(port)
    return {
        "status": "ok",
        "port": port,
        "in_use": in_use,
        "available": not in_use,
    }


@router.post("/ports/allocate", response_model=Dict[str, Any])
def allocate_port(preferred_port: Optional[int] = Query(None, ge=1, le=65535)):
    """Allocates a safe, non-colliding host port."""
    try:
        port = PortManager.find_available_port(preferred_port=preferred_port)
        return {
            "status": "ok",
            "allocated_port": port,
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
