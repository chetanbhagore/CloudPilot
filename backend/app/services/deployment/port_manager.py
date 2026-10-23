"""Host Port and Conflict Management Service.

Detects port collisions on the host system and safely allocates non-conflicting
ports for container deployments.
"""

from __future__ import annotations

import socket
import threading
from typing import Optional, Set


class PortManager:
    """Detects active host socket bindings and allocates available ports."""

    _allocated_ports: Set[int] = set()
    _lock = threading.Lock()

    @classmethod
    def is_port_in_use(cls, port: int, host: str = "127.0.0.1") -> bool:
        """Check if a port is currently listening or bound by an active process."""
        with cls._lock:
            if port in cls._allocated_ports:
                return True

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            # Try binding to verify availability
            try:
                sock.bind((host, port))
                return False
            except (socket.error, OSError):
                return True

    @classmethod
    def find_available_port(
        cls,
        preferred_port: Optional[int] = None,
        min_port: int = 3000,
        max_port: int = 9999,
        host: str = "127.0.0.1",
    ) -> int:
        """Finds the next available port, favoring the preferred port if unblocked."""
        with cls._lock:
            # Check preferred port first
            if preferred_port and not cls._is_socket_bound(preferred_port, host) and preferred_port not in cls._allocated_ports:
                cls._allocated_ports.add(preferred_port)
                return preferred_port

            # Scan the range
            for candidate in range(min_port, max_port + 1):
                if candidate in cls._allocated_ports:
                    continue
                if not cls._is_socket_bound(candidate, host):
                    cls._allocated_ports.add(candidate)
                    return candidate

        raise RuntimeError(f"No available ports found in range {min_port}-{max_port}")

    @classmethod
    def release_port(cls, port: int) -> None:
        """Releases an in-memory allocated port reservation."""
        with cls._lock:
            cls._allocated_ports.discard(port)

    @classmethod
    def get_allocated_ports(cls) -> Set[int]:
        """Returns the set of in-memory allocated ports."""
        with cls._lock:
            return set(cls._allocated_ports)

    @classmethod
    def clear_allocations(cls) -> None:
        """Clears all in-memory reservations (useful for test resets)."""
        with cls._lock:
            cls._allocated_ports.clear()

    @staticmethod
    def _is_socket_bound(port: int, host: str) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.3)
            try:
                sock.bind((host, port))
                return False
            except (socket.error, OSError):
                return True
