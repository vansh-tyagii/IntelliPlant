"""Thread-safe store of the latest result per agent, keyed by zone.

This lets the Planner answer follow-up questions (e.g. "why is Zone B
critical?") from the last computed Fusion result instead of re-running
every model on every chat message - the actual mechanism behind the "don't
rerun SWaT for a follow-up question" requirement.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any, Optional

from core.logger import get_logger

LOGGER = get_logger("orchestrator.memory")


class SharedMemory:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict[str, dict[str, Any]] = {}

    def update(self, zone: str, agent: str, result: dict[str, Any]) -> None:
        with self._lock:
            zone_state = self._state.setdefault(zone, {})
            zone_state[agent] = result
            zone_state["_updated_at"] = datetime.now(timezone.utc).isoformat()

    def get(self, zone: str, agent: str) -> Optional[dict[str, Any]]:
        with self._lock:
            return self._state.get(zone, {}).get(agent)

    def snapshot(self, zone: str) -> dict[str, Any]:
        with self._lock:
            return dict(self._state.get(zone, {}))

    def all_zones(self) -> list[str]:
        with self._lock:
            return list(self._state.keys())


MEMORY = SharedMemory()
