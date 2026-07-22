"""PPE Agent - thin wrapper around the frozen YOLO detector, reusing the
existing module45/ppe_fusion_adapter.py (also frozen) for feature
extraction so there is exactly one place that reads PPE class_counts.
"""
from __future__ import annotations

from typing import Any, Mapping

from core.config import PROJECT_ROOT  # noqa: F401  (import wires sys.path)
from core.logger import get_logger

from module45.ppe_fusion_adapter import ppe_report_to_fusion_features, run_ppe_frame, reset_ppe_tracking

LOGGER = get_logger("agent.ppe")


class PpeAgent:
    name = "ppe"

    def run_from_frame(self, frame: Any, track: bool = False) -> dict[str, Any]:
        """Live path: pass one decoded OpenCV BGR frame (webcam/RTSP/video)."""
        _, report = run_ppe_frame(frame, track=track)
        return self._standardize(report)

    def reset_tracking(self) -> None:
        reset_ppe_tracking()

    def run_from_report(self, report: Mapping[str, Any]) -> dict[str, Any]:
        """Pre-computed path: pass an existing PPE report (e.g. from
        PPE/reports/latest.json or an upstream video-processing service).
        """
        return self._standardize(dict(report))

    @staticmethod
    def _standardize(report: dict[str, Any]) -> dict[str, Any]:
        features = ppe_report_to_fusion_features(report)

        violations = report.get("violations")
        if violations is None:
            violations = sum(report.get("violation_counts", {}).values())

        workers = features["worker_count"]
        # Video reports carry per-frame compliance. Use that aggregate rather
        # than accumulated detection events so risk is not inflated by length.
        if report.get("average_ppe_compliance") is not None:
            features["ppe_risk_score"] = round(1.0 - float(report["average_ppe_compliance"]), 4)
            features["compliance_score"] = round(float(report["average_ppe_compliance"]), 4)
        risk_score = round(features["ppe_risk_score"] * 100, 1)
        status = "critical" if risk_score >= 60 else "warning" if risk_score > 0 else "normal"

        missing_items = [
            label
            for label, key in (
                ("helmet", "helmet_missing"),
                ("safety vest", "vest_missing"),
                ("mask", "mask_missing"),
            )
            if features[key] > 0
        ]
        reason = (
            f"{workers} worker(s) detected; missing {', '.join(missing_items)}."
            if missing_items
            else f"{workers} worker(s) detected; no PPE violations."
        )

        return {
            "agent": "ppe",
            "status": status,
            "risk_score": risk_score,
            "workers": workers,
            "violations": violations,
            "reason": reason,
            "fusion_features": features,
            "raw": report,
        }
