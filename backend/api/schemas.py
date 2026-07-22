"""Pydantic request schemas for the FastAPI layer.

Every field maps 1:1 onto what the corresponding agent's `run()` needs, so
api/main.py can stay a thin translation layer with no business logic of
its own.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class SwatInput(BaseModel):
    """Exactly one of `reading` (streaming, one new row) or `history`
    (batch/replay, >=15 raw rows) should be set."""

    reading: Optional[dict[str, float]] = None
    history: Optional[list[dict[str, float]]] = None


class Ai4iInput(BaseModel):
    air_temp: float
    process_temp: float
    rpm: float
    torque: float
    tool_wear: float
    machine_type: str = Field(pattern="^[LMHlmh]$", description="L, M or H")


class PpeInput(BaseModel):
    """`report` should look like PPE/reports/latest.json. `frame` (a raw
    image array) is only usable when calling the Python API directly, not
    over JSON/HTTP - use `report` for the REST API."""

    report: Optional[dict[str, Any]] = None


class PermitRecord(BaseModel):
    permit_id: str
    type: str = Field(description="HOT_WORK | ELECTRICAL | CONFINED_SPACE | GAS_TESTING | NONE")
    zone: Optional[str] = None
    isolation_verified: bool = False
    gas_test_passed: bool = False
    supervisor_assigned: bool = False
    workers_assigned: int = 0


class PermitContext(BaseModel):
    zone: Optional[str] = None
    maintenance_active: bool = False
    sensor_anomaly_score: Optional[float] = None


class PermitInput(BaseModel):
    permits: list[PermitRecord] = Field(default_factory=list)
    context: PermitContext = Field(default_factory=PermitContext)


class ShiftInput(BaseModel):
    supervisor_present: bool = True
    duration_hours: float = 8.0
    is_night_shift: bool = False
    workers_on_shift: int = 0
    max_recommended_workers: int = 12
    minutes_to_shift_change: Optional[float] = None


class AnalyzeRequest(BaseModel):
    zone: str = "default"
    agents: Optional[list[str]] = Field(
        default=None,
        description="Explicit agent list to run. Omit to run the full pipeline.",
    )
    swat: Optional[SwatInput] = None
    ai4i: Optional[Ai4iInput] = None
    ppe: Optional[PpeInput] = None
    permit: Optional[PermitInput] = None
    shift: Optional[ShiftInput] = None
    query: Optional[str] = Field(
        default=None, description="Optional question passed to the Compliance Agent if it runs."
    )


class ChatRequest(BaseModel):
    zone: str = "default"
    query: str
    swat: Optional[SwatInput] = None
    ai4i: Optional[Ai4iInput] = None
    ppe: Optional[PpeInput] = None
    permit: Optional[PermitInput] = None
    shift: Optional[ShiftInput] = None


class IncidentRequest(BaseModel):
    zone: str = "default"


class ComplianceRequest(BaseModel):
    zone: str = "default"
    question: str


class LiveStartRequest(BaseModel):
    """Start a three-second replay using real project datasets and a video."""

    zone: str = "default"
    interval_seconds: float = Field(default=3.0, gt=0)
    swat_csv: Optional[str] = None
    ai4i_csv: Optional[str] = None
    video_path: Optional[str] = None
    permit: Optional[PermitInput] = None
    shift: Optional[ShiftInput] = None


class LiveContextRequest(BaseModel):
    """Persist permit/shift inputs until this zone's context is updated."""

    permit: Optional[PermitInput] = None
    shift: Optional[ShiftInput] = None
