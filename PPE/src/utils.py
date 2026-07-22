"""Non-model-specific helpers for local PPE inference."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def iou(box_a: list[float], box_b: list[float]) -> float:
    """Intersection-over-union for two ``[x1, y1, x2, y2]`` boxes."""
    left, top = max(box_a[0], box_b[0]), max(box_a[1], box_b[1])
    right, bottom = min(box_a[2], box_b[2]), min(box_a[3], box_b[3])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    area_a = max(0.0, box_a[2] - box_a[0]) * max(0.0, box_a[3] - box_a[1])
    area_b = max(0.0, box_b[2] - box_b[0]) * max(0.0, box_b[3] - box_b[1])
    union = area_a + area_b - intersection
    return intersection / union if union else 0.0


def remove_duplicates(detections: list[dict[str, Any]], threshold: float) -> list[dict[str, Any]]:
    """Keep the highest-confidence overlapping box per model class."""
    kept: list[dict[str, Any]] = []
    for detection in sorted(detections, key=lambda item: item["confidence"], reverse=True):
        if not any(detection["class_id"] == prior["class_id"] and iou(detection["bbox_xyxy"], prior["bbox_xyxy"]) >= threshold for prior in kept):
            kept.append(detection)
    return kept


def detection_color(label: str) -> tuple[int, int, int]:
    """BGR colour based only on the original class label convention."""
    lowered = label.casefold()
    if lowered.startswith("no-"):
        return (0, 0, 255)      # missing/non-compliance
    if lowered == "person" or "safety" in lowered or "hardhat" in lowered or "mask" in lowered:
        return (0, 200, 0)      # detected safety item / worker
    return (0, 215, 255)        # other model-supported scene object


def draw(frame: np.ndarray, detections: list[dict[str, Any]]) -> np.ndarray:
    """Draw exact loaded-model labels and optional worker IDs."""
    annotated = frame.copy()
    for item in detections:
        x1, y1, x2, y2 = (int(value) for value in item["bbox_xyxy"])
        identifier = f" #{item['worker_id']}" if item.get("worker_id") is not None else ""
        text = f"{item['class']}{identifier} {item['confidence']:.2f}"
        colour = detection_color(item["class"])
        cv2.rectangle(annotated, (x1, y1), (x2, y2), colour, 2)
        cv2.putText(annotated, text, (x1, max(18, y1 - 7)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, colour, 2, cv2.LINE_AA)
    return annotated
