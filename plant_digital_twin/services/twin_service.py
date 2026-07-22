from __future__ import annotations

from copy import deepcopy
from typing import Any

from ..adapters.rag import RagAdapter
from ..adapters.runtime_state import RuntimeStateAdapter
from ..core.config import load_json
from ..models.entities import ZoneState, now
from .incident_engine import IncidentEngine


class TwinService:
    def __init__(self) -> None:
        plant = load_json("plant_metadata.json")
        self.plant = {key: value for key, value in plant.items() if key != "zones"}
        self.mapping: dict[str, str] = load_json("zone_mapping.json")
        self.scenarios: dict[str, Any] = load_json("scenarios.json")
        self._initial = {item["zone_id"]: ZoneState(**item) for item in plant["zones"]}
        self.zones = deepcopy(self._initial)
        self.incidents = IncidentEngine()
        self.rag = RagAdapter()
        self.runtime = RuntimeStateAdapter()

    def list_zones(self) -> list[dict[str, Any]]:
        return [zone.dump() for zone in self.zones.values()]

    def zone(self, zone_id: str) -> dict[str, Any] | None:
        state = self.zones.get(zone_id)
        return state.dump() if state else None

    def update(self, source: str, payload: dict[str, Any], zone_id: str | None = None, request_recommendation: bool = False) -> dict[str, Any]:
        target = zone_id or self.mapping.get(source)
        if not target or target not in self.zones:
            raise KeyError(target or source)
        state = self.zones[target]
        normalized = self._normalise(source, payload)
        for key, value in normalized.items():
            if hasattr(state, key): setattr(state, key, value)
        state.last_update = now()
        event = {"timestamp": state.last_update, "source": source, "risk_level": state.risk_level, "message": self._message(source, normalized), "payload": payload}
        state.timeline.append(event)
        if request_recommendation:
            recommendation = self.rag.recommend(state.dump())
            if recommendation: state.recommendation = recommendation
        zone = state.dump()
        incident = self.incidents.create_if_needed(zone, [source])
        return {"zone": zone, "incident": incident}

    def _normalise(self, source: str, payload: dict[str, Any]) -> dict[str, Any]:
        output = dict(payload)
        status = str(payload.get("status") or payload.get("risk_level") or "unknown").lower()
        if source == "ai4i": output.setdefault("machine_status", status)
        elif source == "swat": output.setdefault("swat_status", status)
        elif source == "ppe": output.setdefault("ppe_status", status)
        elif source == "fusion": output.setdefault("fusion_status", status)
        if source == "fusion" and "risk_level" not in output: output["risk_level"] = status
        return output

    @staticmethod
    def _message(source: str, payload: dict[str, Any]) -> str:
        return str(payload.get("message") or payload.get("recommendation") or f"{source} runtime update received")

    def load_scenario(self, scenario_id: str, request_recommendation: bool = False) -> dict[str, Any]:
        scenario = self.scenarios.get(scenario_id)
        if scenario is None: raise KeyError(scenario_id)
        results = [self.update(item["source"], item["payload"], item["zone_id"], request_recommendation) for item in scenario["updates"]]
        return {"scenario_id": scenario_id, "scenario_name": scenario["name"], "updates": results}

    def sync_runtime(self, runtime_zone: str, request_recommendation: bool = False) -> list[dict[str, Any]]:
        """Consume cached runtime outputs; this deliberately never invokes an agent/model."""
        snapshot = self.runtime.snapshot(runtime_zone)
        results = []
        for source, output in snapshot.items():
            mapped_source = "operational_context" if source in {"permit", "shift"} else source
            if mapped_source in self.mapping:
                # A named plant-zone runtime is intentionally isolated from
                # other zones. Unknown runtime labels use configured mapping.
                target = runtime_zone if runtime_zone in self.zones else None
                results.append(self.update(mapped_source, output, target, request_recommendation))
        return results

    def reset(self) -> None:
        self.zones = deepcopy(self._initial); self.incidents.reset()

    def summary(self) -> dict[str, Any]:
        zones = self.list_zones(); levels = {level: sum(z["risk_level"].lower() == level for z in zones) for level in ("normal", "warning", "critical")}
        return {"plant": self.plant, "zone_count": len(zones), "risk_counts": levels, "open_incidents": len(self.incidents.list())}
