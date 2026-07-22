"""Dynamic local inference module for the inspected Construction Site Safety model.

Public API: ``process_frame(frame) -> (annotated_frame, structured_json)``.
The class names and IDs always come from the loaded model's ``model.names``.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from time import perf_counter
from typing import Any

import numpy as np

from tracker import PersonTracker
from utils import draw, remove_duplicates

LOGGER = logging.getLogger("ppe.detector")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "models" / "best.pt"
IOU_THRESHOLD = 0.7  # args.yaml from both inspected training runs
IMAGE_SIZE = 640   # discovered from both repository training args.yaml files


class _Detector:
    def __init__(self) -> None:
        model_path = Path(os.getenv("PPE_MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser()
        if not model_path.is_file():
            raise FileNotFoundError(
                f"Model not found: {model_path}. Set PPE_MODEL_PATH to the repository's best.pt file."
            )
        try:
            from ultralytics import YOLO
        except ImportError as error:
            raise RuntimeError("Missing dependency: run `python -m pip install -r PPE/requirements.txt`.") from error
        self.model = YOLO(str(model_path))
        names = self.model.names
        self.names = {int(index): str(label) for index, label in (names.items() if isinstance(names, dict) else enumerate(names))}
        self.person_class_ids = {class_id for class_id, label in self.names.items() if label.casefold() == "person"}
        self.tracker = PersonTracker() if self.person_class_ids else None
        self.model_path = model_path
        LOGGER.info("Loaded %s with class map %s", model_path, self.names)

    def reset_tracking(self) -> None:
        """Reset persistent ByteTrack state before a new uploaded media item."""
        self.tracker = PersonTracker() if self.person_class_ids else None
        predictor = getattr(self.model, "predictor", None)
        if predictor is not None and hasattr(predictor, "trackers"):
            predictor.trackers = None

    def process(self, frame: np.ndarray, track: bool = False) -> tuple[np.ndarray, dict[str, Any]]:
        if frame is None or not isinstance(frame, np.ndarray) or frame.size == 0:
            raise ValueError("frame must be a non-empty OpenCV BGR image")
        started = perf_counter()
        try:
            if track:
                tracked_results = self.model.track(
                    frame, persist=True, tracker="bytetrack.yaml",
                    iou=IOU_THRESHOLD, imgsz=IMAGE_SIZE, verbose=False,
                )
                if tracked_results and tracked_results[0] is not None:
                    result = tracked_results[0]
                else:
                    LOGGER.warning("ByteTrack returned no result; falling back to detection for this frame.")
                    result = self.model.predict(frame, iou=IOU_THRESHOLD, imgsz=IMAGE_SIZE, verbose=False)[0]
            else:
                result = self.model.predict(frame, iou=IOU_THRESHOLD, imgsz=IMAGE_SIZE, verbose=False)[0]
        except Exception as error:
            LOGGER.exception("Model inference failed")
            raise RuntimeError(f"PPE inference failed: {error}") from error

        detections = remove_duplicates(self._read(result), IOU_THRESHOLD)
        self._assign_worker_ids(detections, use_model_ids=track)
        class_counts = {label: 0 for label in self.names.values()}
        for detection in detections:
            class_counts[detection["class"]] += 1
        negative_classes = [label for label in self.names.values() if label.casefold().startswith("no-")]
        violation_counts = {label: class_counts[label] for label in negative_classes}
        report: dict[str, Any] = {
            "model_path": str(self.model_path),
            "class_map": self.names,
            "class_counts": class_counts,
            "violation_counts": violation_counts,
            "violations": sum(violation_counts.values()),
            "confidence_threshold": "ultralytics_default",
            "iou_threshold": IOU_THRESHOLD,
            "image_size": IMAGE_SIZE,
            "detections": detections,
            "fps": round(1 / max(perf_counter() - started, 1e-9), 2),
        }
        if self.person_class_ids:
            workers = [item for item in detections if item["class_id"] in self.person_class_ids]
            report["workers"] = len(workers)
            report["worker_ids"] = [item["worker_id"] for item in workers]
        else:
            report["worker_statistics_available"] = False
            report["worker_statistics_reason"] = "The loaded model.names contains no Person class."
        return draw(frame, detections), report

    def _read(self, result: Any) -> list[dict[str, Any]]:
        track_ids = result.boxes.id.int().tolist() if result.boxes.id is not None else []
        return [{
            "class_id": int(box.cls.item()),
            "class": self.names[int(box.cls.item())],
            "confidence": round(float(box.conf.item()), 4),
            "bbox_xyxy": [round(float(value), 1) for value in box.xyxy[0].tolist()],
            "worker_id": int(track_ids[index]) if index < len(track_ids) else None,
        } for index, box in enumerate(result.boxes)]

    def _assign_worker_ids(self, detections: list[dict[str, Any]], use_model_ids: bool = False) -> None:
        if self.tracker is None:
            return
        people = [item for item in detections if item["class_id"] in self.person_class_ids]
        if use_model_ids and all(item["worker_id"] is not None for item in people):
            return
        for detection, identifier in zip(people, self.tracker.assign([item["bbox_xyxy"] for item in people])):
            detection["worker_id"] = identifier


_instance: _Detector | None = None


def process_frame(frame: np.ndarray, track: bool = False) -> tuple[np.ndarray, dict[str, Any]]:
    """Run local PPE inference and return ``(annotated_frame, structured_json)``."""
    global _instance
    if _instance is None:
        _instance = _Detector()
    return _instance.process(frame, track=track)


def reset_tracking() -> None:
    if _instance is not None:
        _instance.reset_tracking()
