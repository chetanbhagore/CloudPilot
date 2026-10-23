"""CloudPilot Workload & Deployment Services.

This module provides automated repository scanning, polyglot framework detection,
production-grade Dockerfile synthesis, and dynamic port conflict management.
"""

from .repo_scanner import RepoScanner, ScanResult, FrameworkType
from .dockerfile_synth import DockerfileSynthesizer
from .port_manager import PortManager

__all__ = [
    "RepoScanner",
    "ScanResult",
    "FrameworkType",
    "DockerfileSynthesizer",
    "PortManager",
]
