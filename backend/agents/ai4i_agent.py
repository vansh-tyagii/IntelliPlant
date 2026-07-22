"""AI4I Agent - thin wrapper around the frozen Random Forest predictive
maintenance model. Never modifies ai41/src/inference.py (aside from the one
permitted path fix documented in patched_frozen_files/).
"""
from __future__ import annotations

from typing import Any

from core.config import PROJECT_ROOT  # noqa: F401  (import wires sys.path)
from core.logger import get_logger

from ai41.src.inference import predict_failure

LOGGER = get_logger("agent.ai4i")


class Ai4iAgent:
    name = "ai4i"

    def run(
        self,
        *,
        air_temp: float,
        process_temp: float,
        rpm: float,
        torque: float,
        tool_wear: float,
        machine_type: str,
    ) -> dict[str, Any]:
        result = predict_failure(
            air_temp=air_temp,
            process_temp=process_temp,
            rpm=rpm,
            torque=torque,
            tool_wear=tool_wear,
            machine_type=machine_type,
        )
        is_failure = result["prediction"] != 0
        risk_score = (
            round(result["confidence"] * 100, 1)
            if is_failure
            else round((1 - result["confidence"]) * 30, 1)
        )
        if is_failure:
            reason = (
                f"Predicted failure mode: {result['failure_type']} "
                f"(confidence {result['confidence']:.1%})."
            )
        else:
            reason = f"No failure predicted (confidence {result['confidence']:.1%})."

        status = (
            "critical" if is_failure and result["confidence"] > 0.65
            else "warning" if is_failure
            else "normal"
        )

        return {
            "agent": "ai4i",
            "status": status,
            "risk_score": risk_score,
            "prediction": result["prediction"],
            "failure_type": result["failure_type"],
            "confidence": result["confidence"],
            "reason": reason,
            "raw": result,
        }
