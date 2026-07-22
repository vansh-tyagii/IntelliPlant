"""Inspectable one-shot demonstration pipeline for AI4I, SWaT, PPE and fusion."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Mapping, Sequence

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ai41.src.inference import predict_failure
from swat.src.module1_swat import SwatAnomalyDetector
from module45.fusion_inference import FusionEngine
from module45.ppe_fusion_adapter import ppe_report_to_fusion_features, run_ppe_frame


class DemoOrchestrator:
    """Runs the complete demo while exposing every module's original result."""

    def __init__(self) -> None:
        self.swat = SwatAnomalyDetector()
        self.fusion = FusionEngine()

    def run(
        self,
        ai41_input: Mapping[str, Any],
        current_swat_reading: Mapping[str, Any],
        swat_history: Sequence[Mapping[str, Any]],
        ppe_report: Mapping[str, Any],
        operational_context: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Score one demo event.

        ``swat_history`` must contain exactly 14 earlier raw readings. The UI
        should load these from an approved SWaT dataset/replay file; no history
        is fabricated by this integration layer.
        """
        if len(swat_history) != self.swat.HISTORY_SIZE - 1:
            raise ValueError(f"Provide exactly {self.swat.HISTORY_SIZE - 1} prior SWaT readings.")
        ai41_result = predict_failure(**ai41_input)
        swat_result = self.swat.predict([*swat_history, current_swat_reading])
        ppe_features = ppe_report_to_fusion_features(ppe_report)
        features = {
            "ai41_prediction": ai41_result["prediction"],
            "failure_type": ai41_result["failure_type"],
            "ai41_confidence": ai41_result["confidence"],
            "sensor_anomaly_score": swat_result["anomaly_probability"],
            "swat_status": swat_result["status"],
            **ppe_features,
            **dict(operational_context),
        }
        return {
            "mode": "demo",
            "ai41": ai41_result,
            "swat": swat_result,
            "ppe": dict(ppe_report),
            "fusion": self.fusion.predict(features),
        }

    def run_with_ppe_frame(self, *args: Any, ppe_frame: Any, **kwargs: Any) -> dict[str, Any]:
        """Demo convenience method for a webcam/video frame instead of a report."""
        _, report = run_ppe_frame(ppe_frame)
        return self.run(*args, ppe_report=report, **kwargs)

    def run_user_demo(
        self,
        *,
        ai41_input: Mapping[str, Any],
        swat_reading: Mapping[str, Any],
        previous_swat_readings: Sequence[Mapping[str, Any]],
        ppe_report: Mapping[str, Any],
        operational_context: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Explicit UI-facing demo contract.

        The user supplies the *current* 25-sensor SWaT reading separately;
        the UI/replay supplies exactly 14 preceding readings as its history.
        """
        return self.run(
            ai41_input=ai41_input,
            current_swat_reading=swat_reading,
            swat_history=previous_swat_readings,
            ppe_report=ppe_report,
            operational_context=operational_context,
        )
