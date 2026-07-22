"""The one FastAPI entry point for demo, live, agents, fusion and RAG.

Run from the project root:
    D:\\etai\\.venv-1\\Scripts\\python.exe -m uvicorn final_api.main:app --reload
"""
from __future__ import annotations

import sys
import time
import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
UPLOAD_DIR = PROJECT_ROOT / "runtime_uploads" / "videos"
PROCESSED_MEDIA_DIR = PROJECT_ROOT / "runtime_uploads" / "processed"
for path in (PROJECT_ROOT, BACKEND_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from agents.compliance_agent import ComplianceAgent
from agents.fusion_agent import FusionAgent
from agents.incident_agent import IncidentAgent
from chat.copilot import COPILOT
from module45.demo_orchestrator import DemoOrchestrator
from orchestrator.executor import Executor
from orchestrator.memory import MEMORY
from orchestrator.planner import Plan
from services.live_replay import LIVE_REPLAY
from plant_digital_twin.routers.twin import router as twin_router
from plant_digital_twin.services.twin_service import TwinService
from final_api.platform_router import router as platform_router, ws_router
from rag.rag_bridge import _ensure_index


class Ai4iInput(BaseModel):
    air_temp: float
    process_temp: float
    rpm: float
    torque: float
    tool_wear: float
    machine_type: str = Field(pattern="^[LMHlmh]$")


class OperationalContext(BaseModel):
    permit_conflict_score: float
    shift_context_score: float
    permit_type: str
    permit_active: int
    maintenance_active: int
    isolation_verified: int
    workers_in_zone: int
    supervisor_present: int
    shift_change_flag: int


class DemoRequest(BaseModel):
    """All user-facing fields for one inspectable demo run."""

    zone: str = "demo"
    ai4i: Ai4iInput
    swat_reading: dict[str, float] = Field(description="Current raw SWaT reading: all 25 sensor values.")
    previous_swat_readings: list[dict[str, float]] = Field(
        description="Exactly 14 raw SWaT readings immediately before swat_reading."
    )
    ppe_report: dict[str, Any] = Field(description="Current report generated from the selected PPE video/frame.")
    operational_context: OperationalContext


class LiveStartRequest(BaseModel):
    zone: str = "default"
    interval_seconds: float = Field(default=3.0, gt=0)
    swat_csv: str | None = None
    ai4i_csv: str | None = None
    video_path: str | None = None
    permit: dict[str, Any] | None = None
    shift: dict[str, Any] | None = None
    start_offset: int = Field(default=0, ge=0, description="Dataset row offset; use a different value per zone.")


class LiveStartAllRequest(BaseModel):
    interval_seconds: float = Field(default=3.0, gt=0)
    swat_csv: str | None = None
    ai4i_csv: str | None = None
    video_path: str | None = None
    permit: dict[str, Any] | None = None
    shift: dict[str, Any] | None = None
    offset_step: int = Field(default=15, ge=1)


class LiveContextRequest(BaseModel):
    permit: dict[str, Any] | None = None
    shift: dict[str, Any] | None = None


class AnalyzeRequest(BaseModel):
    zone: str = "default"
    agents: list[str] | None = None
    swat: dict[str, Any] | None = None
    ai4i: dict[str, Any] | None = None
    ppe: dict[str, Any] | None = None
    permit: dict[str, Any] | None = None
    shift: dict[str, Any] | None = None
    query: str | None = None


class ChatRequest(AnalyzeRequest):
    query: str


class ComplianceRequest(BaseModel):
    zone: str = "default"
    question: str


class PpeReportRequest(BaseModel):
    zone: str = "assembly-line"
    report: dict[str, Any] | None = None
    video_path: str | None = None


class SwatAnalyzeRequest(BaseModel):
    zone: str = "control-room"
    reading: dict[str, float] | None = None
    history: list[dict[str, float]] | None = None


class FusionAnalyzeRequest(AnalyzeRequest):
    """Complete multi-model payload; Fusion is calculated only from real upstream outputs."""
    agents: list[str] | None = ["swat", "ai4i", "ppe", "permit", "shift", "fusion"]
    upstream: dict[str, dict[str, Any]] | None = None
    operational_context: OperationalContext | None = None


app = FastAPI(
    title="ET AI Industrial Safety Platform - Final API",
    version="1.0.0",
    description="Single API for demo mode, live replay, safety agents, frozen ML models, fusion, incident reporting and compliance RAG.",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
PROCESSED_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(PROJECT_ROOT / "runtime_uploads")), name="runtime-media")
app.state.twin = TwinService()
app.state.memory = MEMORY
app.state.started_monotonic = time.monotonic()
app.state.playback = {}
app.include_router(twin_router)
app.include_router(platform_router)
app.include_router(ws_router)


@app.on_event("startup")
def initialize_compliance_rag() -> None:
    """Build/reuse the FAISS index before the first compliance request."""
    _ensure_index()

API_LOGGER = logging.getLogger("final_api.requests")

@app.middleware("http")
async def request_log(request: Request, call_next):
    """Compact request/response/latency logging without logging request bodies."""
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        API_LOGGER.exception("api_error method=%s path=%s", request.method, request.url.path)
        raise
    API_LOGGER.info("api_request method=%s path=%s status=%s latency_ms=%.1f", request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
    return response

_demo: DemoOrchestrator | None = None
_executor = Executor()
_incident = IncidentAgent()
_compliance = ComplianceAgent()


def _publish_to_twin(zone: str, result: dict[str, Any]) -> None:
    """Publish completed runtime outputs to the new Twin; no model call occurs here."""
    target = zone if zone in app.state.twin.zones else None
    for source, output in (result.get("results") or {}).items():
        mapped = "operational_context" if source in {"permit", "shift"} else source
        if mapped in app.state.twin.mapping:
            app.state.twin.update(mapped, output, zone_id=target)


def _demo_runner() -> DemoOrchestrator:
    global _demo
    if _demo is None:
        _demo = DemoOrchestrator()
    return _demo


@app.get("/")
def root() -> dict[str, Any]:
    return {"service": "ET AI Unified Industrial Safety API", "docs": "/docs", "status": "ready", "api_prefix": "/api", "catalog": "/api/catalog"}


@app.get("/api/catalog", tags=["service"])
def catalog() -> dict[str, Any]:
    """Frontend discovery document: endpoints are grouped without hiding raw outputs."""
    return {"service": "ETAI Unified Industrial Safety API", "docs": "/docs", "groups": {
        "platform": ["GET /", "GET /api/status", "GET /api/catalog", "GET /api/dashboard", "GET /api/plant/layout", "GET /api/runtime/state", "GET /api/system/health"],
        "models": ["POST /api/models/ai4i/predict", "POST /api/models/swat/analyze", "POST /api/models/ppe/analyze", "POST /api/fusion/analyze"],
        "agents": ["POST /api/agents/analyze", "POST /api/agents/chat"],
        "demo": ["POST /api/demo/run", "POST /api/demo/play", "POST /api/demo/pause", "POST /api/demo/reset", "POST /api/demo/next", "POST /api/demo/previous", "GET /api/demo/status"],
        "live": ["POST /api/uploads/video/{filename}", "POST /api/live/start", "POST /api/live/start-all", "POST /api/live/tick/{zone}", "GET /api/live/status/{zone}", "PUT /api/live/context/{zone}", "POST /api/live/stop/{zone}"],
        "rag_and_incidents": ["POST /api/rag/compliance", "POST /api/incidents/{zone}", "GET /api/incidents"],
        "digital_twin": ["GET /api/v1/zones", "GET /api/v1/zones/{id}", "POST /api/v1/zones/update", "GET /api/v1/zones/timeline", "GET /api/v1/incidents", "POST /api/v1/scenario/load", "POST /api/v1/scenario/reset", "POST /api/v1/runtime/sync/{zone}", "GET /api/v1/plant/status", "GET /api/v1/plant/summary"],
        "websockets": ["WS /ws/runtime", "WS /ws/alerts", "WS /ws/plant", "WS /ws/incidents"]
    }, "available_scenarios": list(app.state.twin.scenarios), "available_videos": [str(path.name) for path in PROJECT_ROOT.glob("*.mp4")], "available_datasets": [str(path.name) for path in PROJECT_ROOT.glob("*.csv")], "plant_metadata": app.state.twin.plant}


@app.post("/api/uploads/video/{filename}", summary="Upload PPE image or video", status_code=201)
async def upload_video(filename: str, request: Request) -> dict[str, Any]:
    """Accept raw video bytes (``Content-Type: video/mp4``) without a frontend dependency.

    Send the returned ``video_path`` in ``POST /api/live/start``. The endpoint
    deliberately accepts only common video extensions and stores uploads only
    under this project's runtime_uploads directory.
    """
    safe_name = Path(filename).name
    if not safe_name or Path(safe_name).suffix.lower() not in {".mp4", ".avi", ".mov", ".mkv", ".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
        raise HTTPException(415, "Use a supported image or video filename.")
    declared_size = int(request.headers.get("content-length", "0") or 0)
    if declared_size > 500 * 1024 * 1024:
        raise HTTPException(413, "Video uploads are limited to 500 MB.")
    content = await request.body()
    if not content:
        raise HTTPException(422, "Video body is empty.")
    if len(content) > 500 * 1024 * 1024:
        raise HTTPException(413, "Video uploads are limited to 500 MB.")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    destination = UPLOAD_DIR / safe_name
    destination.write_bytes(content)
    return {"filename": safe_name, "video_path": str(destination), "media_path": str(destination), "size_bytes": len(content), "content_type": request.headers.get("content-type", "application/octet-stream")}


@app.get("/api/status")
def status() -> dict[str, Any]:
    return {"status": "ready", "project_root": str(PROJECT_ROOT), "agents": ["swat", "ai4i", "ppe", "permit", "shift", "fusion", "compliance", "incident"], "zones": MEMORY.all_zones()}


@app.get("/api/visualizations/heatmap", tags=["visualizations"])
def heatmap_data() -> dict[str, Any]:
    """Frontend-ready plant heatmap data; spatial metadata stays config-only."""
    score = {"normal": 0, "warning": 50, "critical": 100}
    cells = []
    for zone in app.state.twin.list_zones():
        level = str(zone["risk_level"]).lower()
        cells.append({
            "zone_id": zone["zone_id"], "zone_name": zone["zone_name"],
            "risk_level": level, "risk_score": score.get(level, 0),
            "fusion_status": zone["fusion_status"], "last_update": zone["last_update"],
            "metadata": zone["metadata"],
        })
    return {"legend": score, "cells": cells}


@app.get("/api/visualizations/overview", tags=["visualizations"])
def overview_data() -> dict[str, Any]:
    return {"plant": app.state.twin.summary(), "zones": app.state.twin.list_zones(), "incidents": app.state.twin.incidents.list()}


@app.post("/api/demo/run")
def demo_run(request: DemoRequest) -> dict[str, Any]:
    """One complete UI demo. Current SWaT reading is explicitly required."""
    try:
        result = _demo_runner().run_user_demo(
            ai41_input=request.ai4i.model_dump(),
            swat_reading=request.swat_reading,
            previous_swat_readings=request.previous_swat_readings,
            ppe_report=request.ppe_report,
            operational_context=request.operational_context.model_dump(),
        )
        response = {"zone": request.zone, **result}
        # DemoOrchestrator exposes module outputs at the top level, while
        # the Twin consumes the executor-shaped result envelope.
        _publish_to_twin(request.zone, {"results": {key: result[key] for key in ("ai4i", "swat", "ppe", "fusion")}})
        return response
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/live/start")
def live_start(request: LiveStartRequest) -> dict[str, Any]:
    try:
        return LIVE_REPLAY.start(**request.model_dump())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/live/start-all")
def live_start_all(request: LiveStartAllRequest) -> dict[str, Any]:
    """Start one isolated real-data replay per configured plant zone.

    Each session receives a staggered CSV offset, so the same input files
    produce distinct readings for each zone while models remain unchanged.
    """
    sessions: dict[str, Any] = {}
    try:
        for index, zone in enumerate(app.state.twin.zones):
            sessions[zone] = LIVE_REPLAY.start(
                zone=zone, interval_seconds=request.interval_seconds,
                swat_csv=request.swat_csv, ai4i_csv=request.ai4i_csv, video_path=request.video_path,
                permit=request.permit, shift=request.shift, start_offset=index * request.offset_step,
            )
        return {"started_zones": list(sessions), "sessions": sessions}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/live/tick/{zone}")
def live_tick(zone: str) -> dict[str, Any]:
    try:
        result = LIVE_REPLAY.get(zone).tick()
        _publish_to_twin(zone, result)
        return result
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/live/status/{zone}")
def live_status(zone: str) -> dict[str, Any]:
    try:
        return LIVE_REPLAY.get(zone).status()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.put("/api/live/context/{zone}")
def live_context(zone: str, request: LiveContextRequest) -> dict[str, Any]:
    try:
        session = LIVE_REPLAY.get(zone)
        session.update_context(request.permit, request.shift)
        return session.status()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/live/stop/{zone}")
def live_stop(zone: str) -> dict[str, Any]:
    try:
        return LIVE_REPLAY.stop(zone)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/agents/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    try:
        agents = request.agents or ["swat", "ai4i", "ppe", "permit", "shift", "fusion", "compliance", "incident"]
        result = _executor.run(Plan(agents=agents, reasoning="Final API explicit analysis."), request.model_dump())
        _publish_to_twin(request.zone, result)
        return result
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/agents/chat")
def chat(request: ChatRequest) -> dict[str, Any]:
    try:
        return COPILOT.handle_message(request.query, request.model_dump(exclude={"query"}))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/rag/compliance")
def compliance(request: ComplianceRequest) -> dict[str, Any]:
    return _compliance.run(request.question, MEMORY.get(request.zone, "fusion"))


@app.post("/api/incidents/{zone}")
def incident(zone: str) -> dict[str, Any]:
    fusion = MEMORY.get(zone, "fusion")
    if fusion is None:
        raise HTTPException(status_code=409, detail="Run live or agent analysis for this zone before creating an incident.")
    return _incident.generate(zone=zone, fusion=fusion, swat=MEMORY.get(zone, "swat"), ai4i=MEMORY.get(zone, "ai4i"), ppe=MEMORY.get(zone, "ppe"), permit=MEMORY.get(zone, "permit"), shift=MEMORY.get(zone, "shift"))


@app.get("/api/incidents")
def incidents(limit: int = 20) -> dict[str, Any]:
    return {"incidents": _incident.list_recent(limit)}


@app.post("/api/models/ai4i/predict", tags=["models"])
def ai4i_predict(request: Ai4iInput, zone: str = "machine-hall") -> dict[str, Any]:
    result = _executor.run(Plan(agents=["ai4i"], reasoning="Direct frozen AI4I prediction."), {"zone": zone, "ai4i": request.model_dump()})
    _publish_to_twin(zone, result)
    return result


@app.post("/api/models/swat/analyze", tags=["models"])
def swat_analyze(request: SwatAnalyzeRequest) -> dict[str, Any]:
    if bool(request.reading) == bool(request.history):
        raise HTTPException(422, "Provide exactly one of reading (streaming) or history (batch).")
    result = _executor.run(Plan(agents=["swat"], reasoning="Direct frozen SWaT analysis."), {"zone": request.zone, "swat": request.model_dump(exclude={"zone"}, exclude_none=True)})
    _publish_to_twin(request.zone, result)
    return result


@app.post("/api/models/ppe/analyze", tags=["models"])
def ppe_analyze(request: PpeReportRequest) -> dict[str, Any]:
    if bool(request.report) == bool(request.video_path):
        raise HTTPException(422, "Provide exactly one of report or video_path.")
    if request.video_path:
        import cv2
        from uuid import uuid4
        from agents.ppe_agent import PpeAgent
        from module45.ppe_fusion_adapter import run_ppe_frame

        path = Path(request.video_path).resolve()
        upload_root = UPLOAD_DIR.resolve()
        if upload_root not in path.parents or not path.is_file():
            raise HTTPException(422, "video_path must be an uploaded PPE image or video.")
        image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        agent = PpeAgent()
        if path.suffix.lower() in image_extensions:
            frame = cv2.imread(str(path))
            if frame is None:
                raise HTTPException(422, "Could not decode the uploaded image.")
            output = agent.run_from_frame(frame)
            output["raw"].update({"total_frames": 1, "analyzed_frames": 1, "maximum_people_detected": output["workers"], "average_people_detected": float(output["workers"])})
        else:
            capture = cv2.VideoCapture(str(path))
            total_frames = max(int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0), 0)
            sampled_reports: list[dict[str, Any]] = []
            agent.reset_tracking()
            frame_index = 0
            writer = None
            fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
            output_name = f"{path.stem}_{uuid4().hex[:10]}_detected.mp4"
            output_path = PROCESSED_MEDIA_DIR / output_name
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                annotated, frame_report = run_ppe_frame(frame, track=False)
                if writer is None:
                    writer = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (annotated.shape[1], annotated.shape[0]))
                    if not writer.isOpened():
                        raise HTTPException(500, "Could not create detected PPE video.")
                writer.write(annotated)
                if frame_index % 5 == 0:
                    sampled_reports.append(frame_report)
                frame_index += 1
            capture.release()
            if writer is not None:
                writer.release()
            if not sampled_reports:
                raise HTTPException(422, "Could not decode any frames from the uploaded video.")
            class_counts: dict[str, int] = {}
            violation_counts: dict[str, int] = {}
            people_per_frame = []
            unique_workers: set[int] = set()
            compliance_per_frame = []
            detected_items: set[str] = set()
            for report in sampled_reports:
                for label, count in report.get("class_counts", {}).items():
                    class_counts[label] = class_counts.get(label, 0) + int(count or 0)
                    if count and not str(label).casefold().startswith("no-") and str(label).casefold() != "person":
                        detected_items.add(str(label))
                for label, count in report.get("violation_counts", {}).items():
                    violation_counts[label] = violation_counts.get(label, 0) + int(count or 0)
                workers = int(report.get("workers", 0) or 0)
                people_per_frame.append(workers)
                unique_workers.update(int(worker_id) for worker_id in report.get("worker_ids", []) if worker_id is not None)
                compliance_per_frame.append(max(0.0, 1.0 - (int(report.get("violations", 0) or 0) / max(workers, 1))))
            unique_count = len(unique_workers)
            report = {"class_counts": class_counts, "violation_counts": violation_counts, "violations": sum(violation_counts.values()), "workers": unique_count, "unique_workers": unique_count, "total_frames": total_frames or frame_index, "analyzed_frames": len(sampled_reports), "maximum_people_detected": max(people_per_frame, default=0), "average_people_detected": round(sum(people_per_frame) / len(people_per_frame), 2), "average_ppe_compliance": round(sum(compliance_per_frame) / len(compliance_per_frame), 4), "detected_ppe_items": sorted(detected_items), "sampling_interval": 5, "detected_media_url": f"/media/processed/{output_name}"}
            output = agent.run_from_report(report)
        result = {"zone": request.zone, "plan": {"agents": ["ppe"], "reasoning": "Full uploaded PPE media inference."}, "results": {"ppe": output}}
    else:
        result = _executor.run(Plan(agents=["ppe"], reasoning="Direct frozen PPE report analysis."), {"zone": request.zone, "ppe": {"report": request.report}})
    _publish_to_twin(request.zone, result)
    return result


@app.post("/api/fusion/analyze", tags=["models"])
def fusion_analyze(request: FusionAnalyzeRequest) -> dict[str, Any]:
    for module, value in (request.upstream or {}).items():
        if module in {"ai4i", "swat", "ppe"} and value:
            MEMORY.update(request.zone, module, value)
    missing = [module for module in ("ai4i", "swat", "ppe") if MEMORY.get(request.zone, module) is None]
    if missing:
        raise HTTPException(422, detail={"missing_modules": missing})
    if request.operational_context is not None:
        ai4i = MEMORY.get(request.zone, "ai4i")
        swat = MEMORY.get(request.zone, "swat")
        ppe = MEMORY.get(request.zone, "ppe")
        try:
            features = {
                "ai41_prediction": ai4i["prediction"],
                "failure_type": ai4i["failure_type"],
                "ai41_confidence": ai4i["confidence"],
                "sensor_anomaly_score": swat["anomaly_probability"],
                "swat_status": swat.get("raw", {}).get("status", swat["status"]),
                **ppe["fusion_features"],
                **request.operational_context.model_dump(),
            }
            fusion = FusionAgent().run(features)
            MEMORY.update(request.zone, "fusion", fusion)
            result = {"zone": request.zone, "plan": {"agents": ["fusion"], "reasoning": "Fusion from real upstream model outputs and user operational context."}, "results": {"fusion": fusion}}
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(422, f"Invalid upstream output or operational context: {exc}") from exc
        _publish_to_twin(request.zone, result)
        return result
    result = _executor.run(Plan(agents=request.agents or [], reasoning="Direct real-model fusion analysis."), request.model_dump())
    _publish_to_twin(request.zone, result)
    return result
