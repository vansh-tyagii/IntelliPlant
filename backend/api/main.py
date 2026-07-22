"""FastAPI entry point for the Agentic Safety Copilot backend.

    uvicorn api.main:app --reload --port 8000

Run this from inside backend/ (or add backend/ to PYTHONPATH), with the
frozen project root either as backend/'s parent directory or pointed to via
ETAI_PROJECT_ROOT. See README.md for full setup.
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import (
    AnalyzeRequest,
    ChatRequest,
    ComplianceRequest,
    IncidentRequest,
    LiveContextRequest,
    LiveStartRequest,
)
from orchestrator.planner import DEPENDENCY_ORDER, Plan
from orchestrator.executor import Executor
from orchestrator.memory import MEMORY
from agents.incident_agent import IncidentAgent
from agents.compliance_agent import ComplianceAgent
from chat.copilot import COPILOT
from core.config import PROJECT_ROOT, COMPLIANCE_DB_DIR
from core.logger import get_logger
from rag.rag_bridge import _load_frozen_rag_module
from services.live_replay import LIVE_REPLAY

LOGGER = get_logger("api.main")

app = FastAPI(
    title="ET AI Hackathon 2026 - Agentic Industrial Safety Copilot",
    description=(
        "Agentic orchestration layer over the frozen SWaT, AI4I, PPE, Fusion "
        "and Compliance RAG modules. This service never retrains or edits "
        "those modules - it only imports and calls them."
    ),
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = Executor()
_incident_agent = IncidentAgent()
_compliance_agent = ComplianceAgent()


def _model_dump(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    return value.model_dump(exclude_none=True)


@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    """Deterministic direct endpoint: runs exactly the agents you ask for
    (or the full pipeline if `agents` is omitted). This is the endpoint the
    dashboard/demo script should call for a scheduled or manual full scan -
    /chat is the agentic, planner-driven endpoint for free-text questions.
    """
    agents = request.agents or list(DEPENDENCY_ORDER)
    plan = Plan(agents=agents, reasoning="Explicit /analyze request.")
    payload = {
        "zone": request.zone,
        "swat": _model_dump(request.swat),
        "ai4i": _model_dump(request.ai4i),
        "ppe": _model_dump(request.ppe),
        "permit": _model_dump(request.permit),
        "shift": _model_dump(request.shift),
        "query": request.query,
    }
    try:
        return _executor.run(plan, payload)
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Analyze failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/chat")
def chat(request: ChatRequest) -> dict[str, Any]:
    """Agentic endpoint: the Planner reads `query` and decides which agents
    to call - this is the natural-language Safety Copilot entry point."""
    context = {
        "zone": request.zone,
        "swat": _model_dump(request.swat),
        "ai4i": _model_dump(request.ai4i),
        "ppe": _model_dump(request.ppe),
        "permit": _model_dump(request.permit),
        "shift": _model_dump(request.shift),
    }
    try:
        return COPILOT.handle_message(request.query, context)
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Chat failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/incident")
def incident(request: IncidentRequest) -> dict[str, Any]:
    """Direct incident-report generation from whatever is currently cached
    in memory for this zone (call /analyze or /chat with 'analyze plant'
    first if nothing has run yet)."""
    fusion = MEMORY.get(request.zone, "fusion")
    if fusion is None:
        raise HTTPException(
            status_code=409,
            detail=f"No fusion result cached for zone '{request.zone}'. Call /analyze for this zone first.",
        )
    try:
        return _incident_agent.generate(
            zone=request.zone,
            fusion=fusion,
            swat=MEMORY.get(request.zone, "swat"),
            ai4i=MEMORY.get(request.zone, "ai4i"),
            ppe=MEMORY.get(request.zone, "ppe"),
            permit=MEMORY.get(request.zone, "permit"),
            shift=MEMORY.get(request.zone, "shift"),
        )
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Incident generation failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/incident/history")
def incident_history(limit: int = 20) -> dict[str, Any]:
    return {"incidents": _incident_agent.list_recent(limit=limit)}


@app.post("/compliance")
def compliance(request: ComplianceRequest) -> dict[str, Any]:
    """Direct compliance question, using whatever fusion context is cached
    for this zone (may be None, in which case the RAG answers generically)."""
    fusion = MEMORY.get(request.zone, "fusion")
    try:
        return _compliance_agent.run(question=request.question, fusion_context=fusion)
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Compliance query failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/status")
def status() -> dict[str, Any]:
    rag_ready = False
    rag_error: str | None = None
    try:
        _load_frozen_rag_module()
        rag_ready = True
    except Exception as exc:  # noqa: BLE001
        rag_error = str(exc)

    return {
        "project_root": str(PROJECT_ROOT),
        "compliance_db_present": COMPLIANCE_DB_DIR.exists() or (PROJECT_ROOT / "compliance_db").exists(),
        "rag_ready": rag_ready,
        "rag_error": rag_error,
        "zones_in_memory": MEMORY.all_zones(),
        "agents": list(DEPENDENCY_ORDER),
    }


@app.post("/live/start")
def live_start(request: LiveStartRequest) -> dict[str, Any]:
    """Start a background three-second replay of SWaT, AI4I and PPE video.

    Permit and shift data are retained for this zone until `/live/context/{zone}`
    changes them. The first 14 SWaT ticks are valid warm-up events; fusion is
    available from the 15th reading onward.
    """
    try:
        return LIVE_REPLAY.start(
            zone=request.zone,
            interval_seconds=request.interval_seconds,
            swat_csv=request.swat_csv,
            ai4i_csv=request.ai4i_csv,
            video_path=request.video_path,
            permit=_model_dump(request.permit),
            shift=_model_dump(request.shift),
        )
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Could not start live replay")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/live/tick/{zone}")
def live_tick(zone: str) -> dict[str, Any]:
    """Run exactly one replay event. Ideal for a click-through judge demo."""
    try:
        return LIVE_REPLAY.get(zone).tick()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Live replay tick failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/live/status/{zone}")
def live_status(zone: str) -> dict[str, Any]:
    try:
        return LIVE_REPLAY.get(zone).status()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.put("/live/context/{zone}")
def live_context(zone: str, request: LiveContextRequest) -> dict[str, Any]:
    """Replace persisted permit and/or shift UI input for a live zone."""
    try:
        session = LIVE_REPLAY.get(zone)
        session.update_context(_model_dump(request.permit), _model_dump(request.shift))
        return session.status()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/live/stop/{zone}")
def live_stop(zone: str) -> dict[str, Any]:
    try:
        return LIVE_REPLAY.stop(zone)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
