"""SWaT Agent - thin, read-only wrapper around the frozen SWaT LSTM autoencoder.

Never modifies swat/src/module1_swat.py. Only imports it and reshapes its
output into the platform-standard agent envelope: {agent, status, risk_score,
reason, raw}.
"""
from __future__ import annotations

import threading
from typing import Any, Mapping, Sequence

from core.config import PROJECT_ROOT  # noqa: F401  (import wires sys.path)
from core.logger import get_logger

from swat.src.module1_swat import SwatAnomalyDetector

LOGGER = get_logger("agent.swat")

# One SwatAnomalyDetector per zone, since each instance holds real streaming
# state (raw_history, last_valid_values). A single shared instance would mix
# sensor history from different zones into the same rolling sequence.
_detectors: dict[str, SwatAnomalyDetector] = {}
# RLock (not Lock): update_stream()/run_batch() hold this lock for the whole
# call, including the nested _get_detector() call, which also acquires it.
_detectors_lock = threading.RLock()


def _get_detector(zone: str) -> SwatAnomalyDetector:
    with _detectors_lock:
        detector = _detectors.get(zone)
        if detector is None:
            LOGGER.info("Loading frozen SWaT LSTM autoencoder (module1_swat.SwatAnomalyDetector) for zone '%s'.", zone)
            detector = SwatAnomalyDetector()
            _detectors[zone] = detector
        return detector


class SwatAgent:
    """Agent envelope around the frozen IoT/SCADA anomaly detector."""

    name = "swat"

    def reset_stream(self, zone: str = "default") -> None:
        with _detectors_lock:
            detector = _detectors.get(zone)
        if detector is not None:
            detector.reset()

    def update_stream(self, reading: Mapping[str, Any], zone: str = "default") -> dict[str, Any]:
        """Streaming path: push one new raw sensor row and score if ready."""
        with _detectors_lock:
            result = _get_detector(zone).update(reading)
        return self._standardize(result)

    def run_batch(self, history: Sequence[Mapping[str, Any]], zone: str = "default") -> dict[str, Any]:
        """Batch/replay path: score the latest sequence from >=15 raw rows."""
        with _detectors_lock:
            result = _get_detector(zone).predict(history)
        return self._standardize(result)

    @staticmethod
    def _standardize(raw: dict[str, Any]) -> dict[str, Any]:
        if raw.get("status") == "WarmingUp":
            return {
                "agent": "swat",
                "status": "warming_up",
                "risk_score": None,
                "anomaly_probability": None,
                "reason": (
                    f"Collected {raw['history_rows_collected']}/"
                    f"{raw['history_rows_required']} sensor rows; not enough "
                    "history yet for a valid score."
                ),
                "raw": raw,
            }

        probability = raw["anomaly_probability"]
        risk_score = round(probability * 100, 1)
        status = {"Normal": "normal", "Warning": "warning", "Critical": "critical"}.get(
            raw["status"], raw["status"].lower()
        )

        if status == "critical":
            reason = (
                f"Reconstruction error {raw['reconstruction_error']:.6f} exceeds the "
                f"99th-percentile threshold ({raw['threshold_99']:.6f}) - sensor readings "
                "deviate sharply from learned normal process behaviour."
            )
        elif status == "warning":
            reason = (
                f"Reconstruction error {raw['reconstruction_error']:.6f} is between the "
                f"95th ({raw['threshold_95']:.6f}) and 99th percentile thresholds - "
                "early-stage sensor drift detected."
            )
        else:
            reason = "Sensor readings are within the learned normal operating envelope."

        return {
            "agent": "swat",
            "status": status,
            "risk_score": risk_score,
            "anomaly_probability": probability,
            "reason": reason,
            "raw": raw,
        }
