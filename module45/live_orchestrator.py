"""Stateful live integration boundary, ready to be wrapped by an API later."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ai41.src.inference import predict_failure
from swat.src.module1_swat import SwatAnomalyDetector
from module45.fusion_inference import FusionEngine
from module45.ppe_fusion_adapter import ppe_report_to_fusion_features, run_ppe_frame


class LiveOrchestrator:
    """Accepts real-time module inputs without modifying the frozen modules."""

    def __init__(self) -> None:
        self.swat = SwatAnomalyDetector()
        self.fusion = FusionEngine()

    def update(
        self,
        swat_reading: Mapping[str, Any],
        ai41_input: Mapping[str, Any],
        ppe_report: Mapping[str, Any],
        operational_context: Mapping[str, Any],
    ) -> dict[str, Any]:
        swat_result = self.swat.update(swat_reading)
        ai41_result = predict_failure(**ai41_input)
        result: dict[str, Any] = {
            "mode": "live",
            "ai41": ai41_result,
            "swat": swat_result,
            "ppe": dict(ppe_report),
        }
        if swat_result["status"] == "WarmingUp":
            result["fusion"] = None
            result["fusion_status"] = "waiting_for_swat_history"
            return result

        features = {
            "ai41_prediction": ai41_result["prediction"],
            "failure_type": ai41_result["failure_type"],
            "ai41_confidence": ai41_result["confidence"],
            "sensor_anomaly_score": swat_result["anomaly_probability"],
            "swat_status": swat_result["status"],
            **ppe_report_to_fusion_features(ppe_report),
            **dict(operational_context),
        }
        result["fusion"] = self.fusion.predict(features)
        result["fusion_status"] = "scored"
        return result

    def update_with_ppe_frame(self, *args: Any, ppe_frame: Any, **kwargs: Any) -> dict[str, Any]:
        """Live convenience method for a decoded webcam/video frame."""
        _, report = run_ppe_frame(ppe_frame)
        return self.update(*args, ppe_report=report, **kwargs)
