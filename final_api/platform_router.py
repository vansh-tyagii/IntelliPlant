"""Additive frontend-facing APIs around the existing final API services."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from plant_digital_twin.core.config import load_json

LOGGER = logging.getLogger("final_api.platform")
router = APIRouter(prefix="/api", tags=["platform-extension"])
ws_router = APIRouter(tags=["websocket"])
UI_CONFIG = load_json("platform_ui.json")
SEVERITY_ORDER = {"critical": 0, "high": 1, "warning": 1, "medium": 2, "normal": 3, "low": 3, "unknown": 4}


class ScenarioActionRequest(BaseModel):
    scenario_id: str | None = Field(default=None, examples=["critical-emergency"])
    request_recommendation: bool = False


class PlaybackResponse(BaseModel):
    mode: str
    running: bool
    position: int
    available: list[str]
    scenario_id: str | None = None


def _twin(request: Request):
    return request.app.state.twin


def _risk(level: str) -> tuple[str, str]:
    normalized = str(level).lower()
    return normalized, UI_CONFIG["risk_colors"].get(normalized, UI_CONFIG["risk_colors"]["unknown"])


def _zone_view(zone: dict[str, Any], include_runtime: bool = True) -> dict[str, Any]:
    risk, color = _risk(zone["risk_level"])
    layout = UI_CONFIG["zone_layout"].get(zone["zone_id"], {})
    view = {**zone, "display_name": zone["zone_name"], "coordinates": {key: layout.get(key) for key in ("x", "y", "width", "height")}, "icon": layout.get("icon", "map-pin"), "risk_label": risk.title(), "risk_color": color}
    if include_runtime:
        view["alerts"] = [event for event in zone["timeline"] if event.get("risk_level", "normal").lower() in {"warning", "critical"}]
    return view


def _runtime_snapshot(request: Request) -> dict[str, Any]:
    memory = request.app.state.memory
    zones = {zone: memory.snapshot(zone) for zone in memory.all_zones()}
    return {"zones": zones, "last_update": max((data.get("_updated_at", "") for data in zones.values()), default=None), "uptime_seconds": round(time.monotonic() - request.app.state.started_monotonic, 3)}


def _alert_entries(twin: Any) -> list[dict[str, Any]]:
    entries = [{"zone_id": zone["zone_id"], "zone_name": zone["zone_name"], **event} for zone in twin.list_zones() for event in zone["timeline"] if event.get("risk_level", "normal").lower() != "normal"]
    return sorted(entries, key=lambda item: (SEVERITY_ORDER.get(str(item.get("risk_level", "unknown")).lower(), 4), item["timestamp"]))


def _playback(request: Request, mode: str) -> dict[str, Any]:
    state = request.app.state.playback.setdefault(mode, {"running": False, "position": 0, "scenario_id": None})
    available = list(_twin(request).scenarios) if mode == "scenario" else list(_twin(request).zones)
    return {"mode": mode, **state, "available": available}


@router.get("/dashboard", summary="Get dashboard data")
def dashboard(request: Request) -> dict[str, Any]:
    zones = [_zone_view(zone) for zone in _twin(request).list_zones()]
    critical = [zone for zone in zones if zone["risk_level"].lower() == "critical"]
    warning = [zone for zone in zones if zone["risk_level"].lower() == "warning"]
    safe = [zone for zone in zones if zone["risk_level"].lower() == "normal"]
    numeric = {"normal": 0, "warning": 50, "critical": 100}
    return {"system_health": "healthy", "model_status": _runtime_snapshot(request)["zones"], "plant_statistics": _twin(request).summary(), "critical_zones": critical, "warning_zones": warning, "safe_zones": safe, "active_incidents": _twin(request).incidents.list(), "average_risk": round(sum(numeric.get(z["risk_level"].lower(), 0) for z in zones) / max(len(zones), 1), 1), "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/plant/layout", summary="Get configuration-driven plant layout")
def plant_layout(request: Request) -> dict[str, Any]:
    return {"background_image": UI_CONFIG["background_image"], "canvas": UI_CONFIG["canvas"], "zones": [_zone_view(zone, include_runtime=False) for zone in _twin(request).list_zones()]}


@router.get("/zones", summary="List frontend-ready plant zones")
def zones(request: Request) -> dict[str, Any]:
    return {"zones": [_zone_view(zone) for zone in _twin(request).list_zones()]}


@router.get("/zones/{zone_id}", summary="Get one plant zone with runtime outputs")
def zone(zone_id: str, request: Request) -> dict[str, Any]:
    state = _twin(request).zone(zone_id)
    if state is None: raise HTTPException(404, "Unknown zone")
    runtime = request.app.state.memory.snapshot(zone_id)
    return {**_zone_view(state), "latest_ai4i_output": runtime.get("ai4i"), "latest_swat_output": runtime.get("swat"), "latest_ppe_output": runtime.get("ppe"), "fusion_output": runtime.get("fusion")}


@router.get("/timeline", summary="Get chronological plant events")
def timeline(request: Request) -> dict[str, Any]:
    events = [{**event, "zone_id": zone["zone_id"], "zone_name": zone["zone_name"]} for zone in _twin(request).list_zones() for event in zone["timeline"]]
    return {"events": sorted(events, key=lambda event: event["timestamp"], reverse=True)}


@router.get("/zones/{zone_id}/timeline", summary="Get a zone event timeline")
def zone_timeline(zone_id: str, request: Request) -> dict[str, Any]:
    state = _twin(request).zone(zone_id)
    if state is None: raise HTTPException(404, "Unknown zone")
    return {"zone_id": zone_id, "timeline": state["timeline"]}


@router.get("/alerts", summary="Get alerts sorted by severity")
def alerts(request: Request) -> dict[str, Any]:
    return {"alerts": _alert_entries(_twin(request))}


@router.get("/fusion/explain/{zone_id}", summary="Get Fusion explainability for a zone")
def fusion_explain(zone_id: str, request: Request) -> dict[str, Any]:
    fusion = request.app.state.memory.get(zone_id, "fusion")
    if fusion is None: raise HTTPException(404, "No Fusion result is available for this zone")
    contributors = fusion.get("top_contributors") or []
    total = sum(abs(float(item.get("shap_contribution", 0))) for item in contributors) or 1.0
    grouped = {item.get("feature"): item for item in contributors}
    return {"zone_id": zone_id, "fusion_status": fusion.get("status"), "feature_contributions": [{**item, "normalized_percentage": round(abs(float(item.get("shap_contribution", 0))) / total * 100, 2)} for item in contributors], "groups": {"machine": [grouped[name] for name in ("Machine Intelligence",) if name in grouped], "swat": [grouped[name] for name in ("SCADA Intelligence",) if name in grouped], "ppe": [grouped[name] for name in ("PPE Intelligence",) if name in grouped], "operational_context": [grouped[name] for name in ("Operational Context",) if name in grouped]}}


@router.get("/recommendations/{zone_id}", summary="Get RAG-backed safety recommendation")
def recommendations(zone_id: str, request: Request) -> dict[str, Any]:
    zone = _twin(request).zone(zone_id)
    if zone is None: raise HTTPException(404, "Unknown zone")
    level, _ = _risk(zone["risk_level"])
    template = UI_CONFIG["recommendation_templates"].get(level, UI_CONFIG["recommendation_templates"]["normal"])
    rag_answer = _twin(request).rag.recommend(zone)
    return {"zone_id": zone_id, "immediate_action": template["immediate_action"], "oisd": rag_answer, "factory_act": rag_answer, "dgms": rag_answer, "emergency_action": template["emergency_action"], "reason": zone.get("recommendation") or f"Current zone risk is {level}."}


@router.get("/scenarios", summary="List configured scenarios")
def scenarios(request: Request) -> dict[str, Any]:
    return {"scenarios": [{"scenario_id": key, **value} for key, value in _twin(request).scenarios.items()], "playback": _playback(request, "scenario")}


@router.post("/scenarios/load", summary="Load a scenario")
def scenario_load(body: ScenarioActionRequest, request: Request) -> dict[str, Any]:
    if not body.scenario_id: raise HTTPException(422, "scenario_id is required")
    try: result = _twin(request).load_scenario(body.scenario_id, body.request_recommendation)
    except KeyError as exc: raise HTTPException(404, "Unknown scenario") from exc
    state = request.app.state.playback.setdefault("scenario", {"running": False, "position": 0, "scenario_id": None}); state["scenario_id"] = body.scenario_id
    return {"scenario": result, "playback": _playback(request, "scenario")}


@router.post("/scenarios/reset", summary="Reset scenario state")
def scenario_reset(request: Request) -> dict[str, Any]:
    _twin(request).reset(); request.app.state.playback["scenario"] = {"running": False, "position": 0, "scenario_id": None}
    return {"status": "reset", "playback": _playback(request, "scenario")}


@router.post("/scenarios/{action}", summary="Control scenario playback")
def scenario_control(action: str, request: Request) -> dict[str, Any]:
    if action not in {"play", "pause", "next", "previous"}: raise HTTPException(404, "Unknown scenario action")
    state = request.app.state.playback.setdefault("scenario", {"running": False, "position": 0, "scenario_id": None}); count = len(_twin(request).scenarios)
    if action == "play": state["running"] = True
    elif action == "pause": state["running"] = False
    elif action == "next": state["position"] = min(state["position"] + 1, max(count - 1, 0))
    else: state["position"] = max(state["position"] - 1, 0)
    return _playback(request, "scenario")


@router.get("/runtime/state", summary="Get latest runtime state")
def runtime_state(request: Request) -> dict[str, Any]: return _runtime_snapshot(request)


@router.get("/runtime/history", summary="Get runtime history")
def runtime_history(request: Request) -> dict[str, Any]: return timeline(request)


@router.get("/runtime/modules", summary="Get loaded runtime modules")
def runtime_modules(request: Request) -> dict[str, Any]:
    snapshot = _runtime_snapshot(request)["zones"]
    return {"known_modules": ["ai4i", "swat", "ppe", "permit", "shift", "fusion", "compliance", "incident", "rag", "digital_twin"], "loaded_by_zone": {zone: [name for name in values if not name.startswith("_")] for zone, values in snapshot.items()}}


@router.get("/incidents/{incident_id}/report", summary="Get structured Digital Twin incident report")
def incident_report(incident_id: str, request: Request) -> dict[str, Any]:
    incident = _twin(request).incidents.get(incident_id)
    if incident is None: raise HTTPException(404, "Unknown Digital Twin incident")
    zone = _twin(request).zone(incident["affected_zone"])
    return {"incident": incident, "affected_zone": _zone_view(zone) if zone else None, "contributing_modules": incident["contributing_modules"], "timeline": zone["timeline"] if zone else [], "recommendation": incident["recommendation"], "risk_summary": incident["summary"]}


@router.get("/visualizations/plant", summary="Get frontend-ready plant visualization")
def plant_visualization(request: Request) -> dict[str, Any]: return plant_layout(request)


@router.get("/visualizations/zone/{zone_id}", summary="Get frontend-ready zone visualization")
def zone_visualization(zone_id: str, request: Request) -> dict[str, Any]: return zone(zone_id, request)


@router.get("/system/modules", summary="Get system modules")
def system_modules(request: Request) -> dict[str, Any]: return runtime_modules(request)


@router.get("/system/version", summary="Get API version")
def system_version(request: Request) -> dict[str, Any]: return {"api_version": request.app.version, "service": request.app.title}


@router.get("/system/config", summary="Get public configuration")
def system_config(request: Request) -> dict[str, Any]: return {"plant": _twin(request).plant, "zone_mapping": _twin(request).mapping, "ui": UI_CONFIG}


@router.get("/system/health", summary="Get system health")
def system_health(request: Request) -> dict[str, Any]: return {"status": "healthy", "uptime_seconds": _runtime_snapshot(request)["uptime_seconds"], "timestamp": datetime.now(timezone.utc).isoformat(), "modules": runtime_modules(request)}


@router.get("/models/swat/readings", summary="Return N SWAT CSV rows for demo mode — integration adapter only")
def swat_sample_readings(n: int = 15, offset: int = 0) -> dict[str, Any]:
    """Reads rows from the SWAT CSV dataset so the frontend can build a valid
    history payload for POST /api/models/swat/analyze in demo mode.
    No model inference occurs here."""
    import csv as _csv
    from pathlib import Path as _Path
    project_root = _Path(__file__).resolve().parents[1]
    candidates = [project_root / "swat/data/raw/preprocessed_swat_data.csv"]
    csv_path = next((c for c in candidates if c.exists()), None)
    if csv_path is None:
        raise HTTPException(404, "SWAT dataset not found at swat/data/raw/preprocessed_swat_data.csv")
    _SKIP = {"Timestamp", "Label", "Normal/Attack", " Normal/Attack", "timestamp", " timestamp"}
    rows: list[dict[str, float]] = []
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = _csv.DictReader(f)
            for i, row in enumerate(reader):
                if i < offset:
                    continue
                numeric = {k.strip(): float(v) for k, v in row.items() if k.strip() not in _SKIP and v.strip().replace(".", "", 1).replace("-", "", 1).isdigit() or (k.strip() not in _SKIP and _is_float(v))}
                if numeric:
                    rows.append(numeric)
                if len(rows) >= n:
                    break
    except Exception as exc:
        raise HTTPException(500, f"Failed to read SWAT CSV: {exc}") from exc
    return {"readings": rows, "count": len(rows), "offset": offset, "columns": list(rows[0].keys()) if rows else []}


def _is_float(v: str) -> bool:
    try:
        float(v)
        return True
    except (ValueError, TypeError):
        return False


@router.get("/models/ai4i/readings", summary="Return N AI4I CSV rows for demo mode — integration adapter only")
def ai4i_sample_readings(n: int = 5, offset: int = 0) -> dict[str, Any]:
    """Reads rows from the AI4I CSV so the frontend can pre-fill the demo form."""
    import csv as _csv
    from pathlib import Path as _Path
    project_root = _Path(__file__).resolve().parents[1]
    candidates = [project_root / "ai4i2020.csv", project_root / "ai4i_2020.csv"]
    csv_path = next((c for c in candidates if c.exists()), None)
    if csv_path is None:
        raise HTTPException(404, "AI4I dataset not found.")
    FIELD_MAP = {
        "Air temperature [K]": "air_temp", "Process temperature [K]": "process_temp",
        "Rotational speed [rpm]": "rpm", "Torque [Nm]": "torque",
        "Tool wear [min]": "tool_wear", "Type": "machine_type",
    }
    rows: list[dict] = []
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = _csv.DictReader(f)
            for i, row in enumerate(reader):
                if i < offset:
                    continue
                mapped: dict = {}
                for src, dst in FIELD_MAP.items():
                    if src in row:
                        v = row[src].strip()
                        mapped[dst] = v if dst == "machine_type" else float(v)
                if len(mapped) == 6:
                    rows.append(mapped)
                if len(rows) >= n:
                    break
    except Exception as exc:
        raise HTTPException(500, f"Failed to read AI4I CSV: {exc}") from exc
    return {"readings": rows, "count": len(rows), "offset": offset}


@router.post("/demo/{action}", summary="Control demo playback")
def demo_control(action: str, request: Request) -> dict[str, Any]:
    if action not in {"play", "pause", "reset", "next", "previous"}: raise HTTPException(404, "Unknown demo action")
    state = request.app.state.playback.setdefault("demo", {"running": False, "position": 0, "scenario_id": None}); count = len(_twin(request).zones)
    if action == "play": state["running"] = True
    elif action == "pause": state["running"] = False
    elif action == "reset": state.update({"running": False, "position": 0, "scenario_id": None})
    elif action == "next": state["position"] = min(state["position"] + 1, max(count - 1, 0))
    else: state["position"] = max(state["position"] - 1, 0)
    return _playback(request, "demo")


@router.get("/demo/status", summary="Get demo playback status", response_model=PlaybackResponse)
def demo_status(request: Request) -> dict[str, Any]: return _playback(request, "demo")


async def _websocket_stream(websocket: WebSocket, kind: str) -> None:
    await websocket.accept(); previous = None
    try:
        while True:
            app = websocket.scope["app"]
            if kind == "runtime": payload = {"type": kind, "data": {"zones": {zone: app.state.memory.snapshot(zone) for zone in app.state.memory.all_zones()}}}
            elif kind == "alerts": payload = {"type": kind, "data": {"alerts": _alert_entries(app.state.twin)}}
            elif kind == "plant": payload = {"type": kind, "data": app.state.twin.list_zones()}
            else: payload = {"type": kind, "data": app.state.twin.incidents.list()}
            serialized = json.dumps(payload, default=str, sort_keys=True)
            if serialized != previous:
                await websocket.send_text(serialized); previous = serialized
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return


@ws_router.websocket("/ws/runtime")
async def ws_runtime(websocket: WebSocket) -> None: await _websocket_stream(websocket, "runtime")

@ws_router.websocket("/ws/plant")
async def ws_plant(websocket: WebSocket) -> None: await _websocket_stream(websocket, "plant")

@ws_router.websocket("/ws/incidents")
async def ws_incidents(websocket: WebSocket) -> None: await _websocket_stream(websocket, "incidents")


@ws_router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket) -> None: await _websocket_stream(websocket, "alerts")
