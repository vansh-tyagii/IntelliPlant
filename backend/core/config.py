"""Central configuration for the ET AI Agentic Safety Platform backend.

This module resolves the location of the FROZEN existing project (SWaT,
AI4I, PPE, Fusion, Compliance RAG) and puts it on sys.path so every agent
below can `import ai41.src.inference`, `import swat.src.module1_swat`, and
`import module45.fusion_inference` directly - the original, unmodified
packages - with zero copying or rewriting.

Expected layout (matches how module45/live_orchestrator.py already resolves
its own ROOT):

    <project_root>/
        ai41/...
        swat/...
        PPE/...
        module45/...
        config.yaml
        backend/              <- this package lives here
            core/config.py

If your real project root lives somewhere else, set ETAI_PROJECT_ROOT to an
absolute path instead of relying on the default relative resolution.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any


def _resolve_project_root() -> Path:
    env_value = os.getenv("ETAI_PROJECT_ROOT")
    if env_value:
        return Path(env_value).expanduser().resolve()
    # backend/core/config.py -> backend/core -> backend -> project root
    return Path(__file__).resolve().parents[2]


PROJECT_ROOT = _resolve_project_root()
BACKEND_ROOT = Path(__file__).resolve().parents[1]

for _path in (PROJECT_ROOT, BACKEND_ROOT):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))


def load_platform_config() -> dict[str, Any]:
    """Load the existing config.yaml (mode, fusion thresholds, demo sources).

    Never writes to this file. Returns {} if it isn't found instead of
    raising, since the backend should still boot (with defaults) even if
    config.yaml hasn't been placed yet.
    """
    import yaml

    config_path = Path(os.getenv("ETAI_CONFIG_YAML", str(PROJECT_ROOT / "config.yaml")))
    if not config_path.is_file():
        return {}
    with open(config_path, "r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


PLATFORM_CONFIG = load_platform_config()
_FUSION_CFG = PLATFORM_CONFIG.get("fusion", {}) or {}

FUSION_MODEL_PATH = Path(
    os.getenv(
        "ETAI_FUSION_MODEL_PATH",
        str(PROJECT_ROOT / _FUSION_CFG.get("model_path", "module45/engines/fusion_model.cbm")),
    )
)

SAFE_MAX_PROBABILITY = float(_FUSION_CFG.get("safe_max_probability", 0.30))
WARNING_MAX_PROBABILITY = float(_FUSION_CFG.get("warning_max_probability", 0.65))

# Frozen Compliance RAG: point this at the real, unmodified rag_agent.py.
# Defaults to the reference copy kept under backend/rag/legacy/.
RAG_AGENT_PATH = Path(
    os.getenv("ETAI_RAG_AGENT_PATH", str(BACKEND_ROOT / "rag" / "legacy" / "rag_agent.py"))
)

# Where build_db.py wrote the FAISS index (rag_agent.py loads "compliance_db"
# relative to the process's working directory - this is only used here for a
# helpful boot-time existence check, not to override that behaviour).
COMPLIANCE_DB_DIR = Path(os.getenv("ETAI_COMPLIANCE_DB_DIR", str(BACKEND_ROOT / "compliance_db")))

INCIDENT_STORE_DIR = Path(os.getenv("ETAI_INCIDENT_STORE_DIR", str(BACKEND_ROOT / "data" / "incidents")))
INCIDENT_STORE_DIR.mkdir(parents=True, exist_ok=True)

DEMO_MODE = str(PLATFORM_CONFIG.get("mode", "demo")).lower() == "demo"
