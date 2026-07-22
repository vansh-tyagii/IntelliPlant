from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4
from typing import Any


class IncidentEngine:
    TRIGGER_LEVELS = {"warning", "critical"}

    def __init__(self) -> None:
        self._incidents: list[dict[str, Any]] = []
        self._dedupe: set[tuple[str, str, str]] = set()

    def create_if_needed(self, zone: dict[str, Any], sources: list[str]) -> dict[str, Any] | None:
        risk = str(zone["risk_level"]).lower()
        # Incidents are a deterministic consequence of Fusion only; upstream
        # warnings remain timeline events until Fusion corroborates them.
        if str(zone.get("fusion_status", "")).lower() not in self.TRIGGER_LEVELS:
            return None
        fingerprint = (zone["zone_id"], str(zone.get("fusion_status")), risk)
        if fingerprint in self._dedupe:
            return None
        self._dedupe.add(fingerprint)
        incident = {
            "incident_id": f"INC-{uuid4().hex[:10].upper()}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "affected_zone": zone["zone_id"], "risk": risk,
            "contributing_modules": sorted(set(sources)),
            "recommendation": zone.get("recommendation") or "Escalate to the safety supervisor and verify controls.",
            "summary": f"{risk.upper()} fusion-related incident in {zone['zone_name']}."
        }
        self._incidents.append(incident)
        return incident

    def list(self) -> list[dict[str, Any]]:
        return list(reversed(self._incidents))

    def get(self, incident_id: str) -> dict[str, Any] | None:
        return next((item for item in self._incidents if item["incident_id"] == incident_id), None)

    def reset(self) -> None:
        self._incidents.clear(); self._dedupe.clear()
