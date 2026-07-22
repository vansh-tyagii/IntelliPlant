"""Lightweight person-ID persistence for a repository that does not use ByteTrack."""

from __future__ import annotations

from dataclasses import dataclass

from utils import iou


@dataclass
class _Track:
    identifier: int
    box: list[float]
    missed_frames: int = 0


class PersonTracker:
    """Assign stable IDs to Person detections using IoU frame association.

    The inspected repository uses plain YOLO inference (not ByteTrack/BoTSORT at
    inference time), so this tracker deliberately has no model-specific labels.
    """

    def __init__(self, match_iou: float = 0.3, max_missed_frames: int = 30) -> None:
        self.match_iou = match_iou
        self.max_missed_frames = max_missed_frames
        self._tracks: list[_Track] = []
        self._next_identifier = 1

    def assign(self, boxes: list[list[float]]) -> list[int]:
        for track in self._tracks:
            track.missed_frames += 1
        assignments: list[int] = []
        used: set[int] = set()
        for box in boxes:
            candidates = [(index, iou(box, track.box)) for index, track in enumerate(self._tracks) if index not in used]
            index, overlap = max(candidates, key=lambda item: item[1], default=(-1, 0.0))
            if index >= 0 and overlap >= self.match_iou:
                track = self._tracks[index]
                track.box, track.missed_frames = box, 0
                used.add(index)
                assignments.append(track.identifier)
            else:
                track = _Track(self._next_identifier, box)
                self._next_identifier += 1
                self._tracks.append(track)
                used.add(len(self._tracks) - 1)
                assignments.append(track.identifier)
        self._tracks = [track for track in self._tracks if track.missed_frames <= self.max_missed_frames]
        return assignments
