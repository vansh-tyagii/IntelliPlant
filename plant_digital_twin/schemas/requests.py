from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class ZoneUpdateRequest(BaseModel):
    zone_id: str | None = None
    source: str = Field(description="Runtime producer, such as fusion, swat, ai4i, or ppe.")
    payload: dict[str, Any] = Field(default_factory=dict)
    request_recommendation: bool = False


class ScenarioLoadRequest(BaseModel):
    scenario_id: str
    request_recommendation: bool = False
