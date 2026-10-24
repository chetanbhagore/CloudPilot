"""Repository scanner and polyglot framework detection engine.

Analyzes source tree, manifest files, and configurations to determine:
- Language and framework
- Web service vs background worker
- Default runtime port
- Application entrypoint
- Environment variables required
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


class FrameworkType(str, Enum):
    FASTAPI = "fastapi"
    DJANGO = "django"
    FLASK = "flask"
    STREAMLIT = "streamlit"
    EXPRESS = "express"
    NEXTJS = "nextjs"
    REACT_VITE = "react_vite"
    GO = "go"
    PYTHON_GENERIC = "python_generic"
    NODE_GENERIC = "node_generic"
    UNKNOWN = "unknown"


@dataclass
class ScanResult:
    framework: FrameworkType
    language: str
    is_worker: bool
    default_port: Optional[int]
    entrypoint: str
    detected_files: List[str]
    env_vars: List[str] = field(default_factory=list)
    has_dockerfile: bool = False
    confidence: float = 1.0
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "framework": self.framework.value,
            "language": self.language,
            "is_worker": self.is_worker,
            "default_port": self.default_port,
            "entrypoint": self.entrypoint,
            "detected_files": self.detected_files,
            "env_vars": self.env_vars,
            "has_dockerfile": self.has_dockerfile,
            "confidence": self.confidence,
            "details": self.details,
        }


class RepoScanner:
    """Introspects a directory or repository structure to identify workload runtime."""

    @classmethod
    def scan_directory(cls, repo_path: str | Path) -> ScanResult:
        path = Path(repo_path).resolve()
        if not path.exists() or not path.is_dir():
            raise FileNotFoundError(f"Repository path does not exist: {path}")

        files = cls._list_top_files(path)
        has_dockerfile = (path / "Dockerfile").exists() or (path / "dockerfile").exists()

        # Check for non-web workers first (Celery, worker.py, etc.)
        is_worker = cls._detect_worker(path, files)

        # 1. Check Python ecosystems
        if (path / "requirements.txt").exists() or (path / "pyproject.toml").exists() or (path / "Pipfile").exists():
            return cls._inspect_python(path, files, is_worker, has_dockerfile)

        # 2. Check Node.js ecosystems
        if (path / "package.json").exists():
            return cls._inspect_node(path, files, is_worker, has_dockerfile)

        # 3. Check Go ecosystems
        if (path / "go.mod").exists() or (path / "main.go").exists():
            return cls._inspect_go(path, files, is_worker, has_dockerfile)

        # Fallback unknown
        env_vars = cls._extract_env_vars(path)
        return ScanResult(
            framework=FrameworkType.UNKNOWN,
            language="unknown",
            is_worker=is_worker,
            default_port=None if is_worker else 8080,
            entrypoint="",
            detected_files=files[:10],
            env_vars=env_vars,
            has_dockerfile=has_dockerfile,
            confidence=0.1,
            details={"message": "Could not conclusively detect framework manifests."},
        )

    @classmethod
    def _list_top_files(cls, path: Path) -> List[str]:
        result = []
        try:
            for item in path.iterdir():
                if not item.name.startswith("."):
                    result.append(item.name)
        except Exception:
            pass
        return sorted(result)

    @classmethod
    def _detect_worker(cls, path: Path, files: List[str]) -> bool:
        # Check files for worker naming
        lower_files = [f.lower() for f in files]
        if any(w in lower_files for w in ["worker.py", "celery.py", "worker.js", "worker.ts"]):
            return True

        # Check if Procfile specifies worker exclusively
        procfile = path / "Procfile"
        if procfile.exists():
            try:
                content = procfile.read_text(encoding="utf-8")
                if "worker:" in content and "web:" not in content:
                    return True
            except Exception:
                pass

        return False

    @classmethod
    def _inspect_python(cls, path: Path, files: List[str], is_worker: bool, has_dockerfile: bool) -> ScanResult:
        deps_text = ""
        for manifest in ["requirements.txt", "pyproject.toml", "Pipfile"]:
            manifest_file = path / manifest
            if manifest_file.exists():
                try:
                    deps_text += "\n" + manifest_file.read_text(encoding="utf-8").lower()
                except Exception:
                    pass

        code_text = ""
        for py_candidate in ["app.py", "main.py", "server.py", "wsgi.py", "run.py", "application.py"]:
            candidate_file = path / py_candidate
            if candidate_file.exists():
                try:
                    code_text += "\n" + candidate_file.read_text(encoding="utf-8", errors="ignore").lower()
                except Exception:
                    pass

        env_vars = cls._extract_env_vars(path)

        # Check Streamlit
        if "streamlit" in deps_text or "streamlit" in code_text:
            entrypoint = "app.py"
            for candidate in ["app.py", "main.py", "streamlit_app.py"]:
                if (path / candidate).exists():
                    entrypoint = candidate
                    break
            return ScanResult(
                framework=FrameworkType.STREAMLIT,
                language="python",
                is_worker=is_worker,
                default_port=None if is_worker else 8501,
                entrypoint=entrypoint,
                detected_files=files,
                env_vars=env_vars,
                has_dockerfile=has_dockerfile,
                confidence=0.95,
                details={"run_command": f"streamlit run {entrypoint} --server.port 8501"},
            )

        # Check Django
        if "django" in deps_text or (path / "manage.py").exists() or "django" in code_text:
            return ScanResult(
                framework=FrameworkType.DJANGO,
                language="python",
                is_worker=is_worker,
                default_port=None if is_worker else 8000,
                entrypoint="manage.py",
                detected_files=files,
                env_vars=env_vars,
                has_dockerfile=has_dockerfile,
                confidence=0.98,
                details={"run_command": "python manage.py runserver 0.0.0.0:8000"},
            )

        # Check FastAPI
        if "fastapi" in deps_text or "fastapi" in code_text:
            entrypoint = cls._find_fastapi_entrypoint(path)
            return ScanResult(
                framework=FrameworkType.FASTAPI,
                language="python",
                is_worker=is_worker,
                default_port=None if is_worker else 8000,
                entrypoint=entrypoint,
                detected_files=files,
                env_vars=env_vars,
                has_dockerfile=has_dockerfile,
                confidence=0.98,
                details={"run_command": f"uvicorn {entrypoint} --host 0.0.0.0 --port 8000"},
            )

        # Check Flask
        if "flask" in deps_text or "flask" in code_text:
            entrypoint = "app:app"
            for candidate in ["app.py", "main.py", "wsgi.py", "run.py", "application.py"]:
                if (path / candidate).exists():
                    entrypoint = f"{candidate[:-3]}:app"
                    break
            return ScanResult(
                framework=FrameworkType.FLASK,
                language="python",
                is_worker=is_worker,
                default_port=None if is_worker else 5000,
                entrypoint=entrypoint,
                detected_files=files,
                env_vars=env_vars,
                has_dockerfile=has_dockerfile,
                confidence=0.92,
                details={"run_command": f"flask run --host=0.0.0.0 --port=5000", "source_inferred": "flask" in code_text and "flask" not in deps_text},
            )

        # Generic Python
        return ScanResult(
            framework=FrameworkType.PYTHON_GENERIC,
            language="python",
            is_worker=is_worker,
            default_port=None if is_worker else 8000,
            entrypoint="main.py" if (path / "main.py").exists() else "app.py",
            detected_files=files,
            env_vars=env_vars,
            has_dockerfile=has_dockerfile,
            confidence=0.75,
            details={"run_command": "python main.py"},
        )

    @classmethod
    def _inspect_node(cls, path: Path, files: List[str], is_worker: bool, has_dockerfile: bool) -> ScanResult:
        pkg_json_file = path / "package.json"
        pkg_data: Dict[str, Any] = {}
        try:
            pkg_data = json.loads(pkg_json_file.read_text(encoding="utf-8"))
        except Exception:
            pass

        deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
        scripts = pkg_data.get("scripts", {})
        env_vars = cls._extract_env_vars(path)

        # Check Next.js
        if "next" in deps:
            return ScanResult(
                framework=FrameworkType.NEXTJS,
                language="nodejs",
                is_worker=is_worker,
                default_port=None if is_worker else 3000,
                entrypoint="next start",
                detected_files=files,
                env_vars=env_vars,
                has_dockerfile=has_dockerfile,
                confidence=0.98,
                details={"build_command": "npm run build", "start_command": "npm start"},
            )

        # Check React / Vite
        if "vite" in deps or (path / "vite.config.ts").exists() or (path / "vite.config.js").exists():
            return ScanResult(
                framework=FrameworkType.REACT_VITE,
                language="nodejs",
                is_worker=is_worker,
                default_port=None if is_worker else 80,
                entrypoint="nginx",
                detected_files=files,
                env_vars=env_vars,
                has_dockerfile=has_dockerfile,
                confidence=0.95,
                details={"build_command": "npm run build", "output_dir": "dist"},
            )

        # Check Express
        if "express" in deps:
            main_file = pkg_data.get("main", "index.js")
            if not (path / main_file).exists():
                for candidate in ["server.js", "app.js", "src/index.js", "src/server.ts"]:
                    if (path / candidate).exists():
                        main_file = candidate
                        break
            return ScanResult(
                framework=FrameworkType.EXPRESS,
                language="nodejs",
                is_worker=is_worker,
                default_port=None if is_worker else 3000,
                entrypoint=f"node {main_file}",
                detected_files=files,
                env_vars=env_vars,
                has_dockerfile=has_dockerfile,
                confidence=0.95,
                details={"main": main_file},
            )

        return ScanResult(
            framework=FrameworkType.NODE_GENERIC,
            language="nodejs",
            is_worker=is_worker,
            default_port=None if is_worker else 3000,
            entrypoint=scripts.get("start", "node index.js"),
            detected_files=files,
            env_vars=env_vars,
            has_dockerfile=has_dockerfile,
            confidence=0.75,
            details={},
        )

    @classmethod
    def _inspect_go(cls, path: Path, files: List[str], is_worker: bool, has_dockerfile: bool) -> ScanResult:
        env_vars = cls._extract_env_vars(path)
        entrypoint = "main.go"
        if (path / "cmd").exists():
            for sub in (path / "cmd").iterdir():
                if sub.is_dir() and (sub / "main.go").exists():
                    entrypoint = f"cmd/{sub.name}/main.go"
                    break

        return ScanResult(
            framework=FrameworkType.GO,
            language="go",
            is_worker=is_worker,
            default_port=None if is_worker else 8080,
            entrypoint=entrypoint,
            detected_files=files,
            env_vars=env_vars,
            has_dockerfile=has_dockerfile,
            confidence=0.95,
            details={"build_command": "go build -o app ."},
        )

    @classmethod
    def _find_fastapi_entrypoint(cls, path: Path) -> str:
        candidates = [
            ("backend/app/main.py", "backend.app.main:app"),
            ("app/main.py", "app.main:app"),
            ("main.py", "main:app"),
            ("app.py", "app:app"),
            ("src/main.py", "src.main:app"),
        ]
        for rel_path, module_app in candidates:
            if (path / rel_path).exists():
                return module_app
        return "main:app"

    @classmethod
    def _extract_env_vars(cls, path: Path) -> List[str]:
        env_set: Set[str] = set()
        for env_sample in [".env.example", ".env.template", ".env.sample"]:
            file = path / env_sample
            if file.exists():
                try:
                    for line in file.read_text(encoding="utf-8").splitlines():
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            var_name = line.split("=", 1)[0].strip()
                            if var_name:
                                env_set.add(var_name)
                except Exception:
                    pass
        return sorted(list(env_set))
