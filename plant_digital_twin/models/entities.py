from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class ZoneState:
    zone_id: str
    zone_name: str
    metadata: dict[str, Any] = field(default_factory=dict)
    machine_status: str = "unknown"
    swat_status: str = "unknown"
    ppe_status: str = "unknown"
    fusion_status: str = "unknown"
    risk_level: str = "normal"
    last_update: str = field(default_factory=now)
    recommendation: str | None = None
    timeline: list[dict[str, Any]] = field(default_factory=list)

    def dump(self) -> dict[str, Any]:
        return asdict(self)
