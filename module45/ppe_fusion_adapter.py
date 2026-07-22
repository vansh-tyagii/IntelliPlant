"""Convert a PPE report into the PPE-related inputs required by fusion."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Mapping


def _count(class_counts: Mapping[str, Any], *labels: str) -> int:
    normalized = {str(key).casefold(): value for key, value in class_counts.items()}
    return sum(int(normalized.get(label.casefold(), 0) or 0) for label in labels)


def ppe_report_to_fusion_features(report: Mapping[str, Any]) -> dict[str, Any]:
    """Return only fusion PPE/scene fields; it never changes PPE inference logic."""
    class_counts = report.get("class_counts", {})
    if not isinstance(class_counts, Mapping):
        raise ValueError("PPE report class_counts must be a mapping.")

    helmet = int(report.get("helmet_missing", _count(class_counts, "NO-Hardhat")) or 0)
    vest = int(report.get("vest_missing", _count(class_counts, "NO-Safety Vest")) or 0)
    mask = int(report.get("mask_missing", _count(class_counts, "NO-Mask")) or 0)
    workers = int(report.get("workers", _count(class_counts, "Person")) or 0)

    # The currently loaded PPE class map has no vehicle/machinery labels. These
    # remain zero unless a future PPE report explicitly provides those counts.
    vehicles = int(report.get("vehicle_count", _count(class_counts, "Vehicle", "Car", "Truck", "Forklift")) or 0)
    machinery = int(report.get("machinery_count", _count(class_counts, "Machinery", "Excavator", "Crane", "Loader")) or 0)
    ppe_risk = min(1.0, (helmet + vest + mask) / max(workers, 1))
    return {
        "ppe_risk_score": round(ppe_risk, 4),
        "helmet_missing": helmet,
        "vest_missing": vest,
        "mask_missing": mask,
        "worker_count": workers,
        "vehicle_count": vehicles,
        "machinery_count": machinery,
        "compliance_score": round(1.0 - ppe_risk, 4),
    }


def run_ppe_frame(frame: Any, track: bool = False) -> tuple[Any, dict[str, Any]]:
    """Call the frozen PPE frame inference and return its original report.

    A web/API layer can pass one decoded OpenCV video or webcam frame here.
    """
    ppe_source = Path(__file__).resolve().parents[1] / "PPE" / "src"
    if str(ppe_source) not in sys.path:
        sys.path.insert(0, str(ppe_source))
    from detector import process_frame
    return process_frame(frame, track=track)


def reset_ppe_tracking() -> None:
    ppe_source = Path(__file__).resolve().parents[1] / "PPE" / "src"
    if str(ppe_source) not in sys.path:
        sys.path.insert(0, str(ppe_source))
    from detector import reset_tracking
    reset_tracking()
