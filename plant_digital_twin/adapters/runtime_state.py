"""Read-only adapter for the existing runtime cache; never executes models."""
from __future__ import annotations

from typing import Any


class RuntimeStateAdapter:
    def snapshot(self, runtime_zone: str) -> dict[str, Any]:
        try:
            from backend.orchestrator.memory import MEMORY
        except ImportError:
            try:
                from orchestrator.memory import MEMORY
            except ImportError:
                return {}
        return {source: MEMORY.get(runtime_zone, source) for source in ("ai4i", "swat", "ppe", "fusion", "permit", "shift") if MEMORY.get(runtime_zone, source) is not None}
