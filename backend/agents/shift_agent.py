"""Shift Agent - deterministic supervision/fatigue rule engine.

Same reasoning as permit_agent.py: the fusion engine's shift-related
columns (supervisor_present, shift_change_flag, shift_context_score) were
synthetic training proxies, not a real trained model. This agent replaces
that proxy with explicit, explainable rules instead of pretending to be an
independently trained shift-risk model.
"""
from __future__ import annotations

from typing import Any, Mapping

from core.logger import get_logger

LOGGER = get_logger("agent.shift")


class ShiftAgent:
    name = "shift"

    def run(self, shift: Mapping[str, Any]) -> dict[str, Any]:
        supervisor_present = bool(shift.get("supervisor_present", True))
        duration = float(shift.get("duration_hours", 8.0) or 8.0)
        is_night = bool(shift.get("is_night_shift", False))
        workers = int(shift.get("workers_on_shift", 0) or 0)
        max_workers = int(shift.get("max_recommended_workers", 12) or 12)
        minutes_to_change = shift.get("minutes_to_shift_change")

        score = 0.0
        reasons: list[str] = []

        if not supervisor_present:
            score += 45
            reasons.append("No supervisor present on this shift.")
        if duration > 10:
            score += 25
            reasons.append(f"Shift duration is {duration:.1f}h, exceeding the 10h fatigue threshold.")
        elif duration > 8:
            score += 10
            reasons.append(f"Shift duration is {duration:.1f}h, above the standard 8h shift.")
        if is_night:
            score += 15
            reasons.append("Night shift in progress - elevated fatigue and reduced supervision are typical.")
        if workers > max_workers:
            score += 20
            reasons.append(f"{workers} workers on shift exceeds the recommended maximum of {max_workers}.")

        shift_change_flag = bool(minutes_to_change is not None and 0 <= float(minutes_to_change) <= 30)
        if shift_change_flag:
            score += 10
            reasons.append("Within 30 minutes of a shift changeover - handover risk window.")

        risk_score = round(min(score, 100), 1)
        status = "critical" if risk_score >= 70 else "warning" if risk_score >= 30 else "normal"

        return {
            "agent": "shift",
            "status": status,
            "risk_score": risk_score,
            "reason": " ".join(reasons) if reasons else "Shift staffing and timing are within normal parameters.",
            "fusion_features": {
                "supervisor_present": int(supervisor_present),
                "shift_change_flag": int(shift_change_flag),
                "shift_context_score": round(risk_score / 100, 4),
            },
            "raw": dict(shift),
        }
