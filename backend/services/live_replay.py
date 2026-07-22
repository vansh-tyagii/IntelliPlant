"""Three-second replay service for the real frozen models.

This is intentionally an API-side service: it does not alter any model or
agent.  Each tick reads one real SWaT row, one real AI4I row and one changing
PPE video frame, then delegates to the existing agent Executor.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

import cv2
import pandas as pd

from core.config import PROJECT_ROOT
from orchestrator.executor import Executor
from orchestrator.planner import Plan
from swat.src.module1_swat import SwatAnomalyDetector


LIVE_AGENT_ORDER = ["swat", "ai4i", "ppe", "permit", "shift", "fusion"]


def _default_permit() -> dict[str, Any]:
    return {"permits": [], "context": {"maintenance_active": False}}


def _default_shift() -> dict[str, Any]:
    return {"supervisor_present": True, "duration_hours": 8.0, "is_night_shift": False, "workers_on_shift": 0}


@dataclass
class ReplaySession:
    zone: str
    swat_csv: Path
    ai4i_csv: Path
    video_path: Path
    interval_seconds: float = 3.0
    permit: dict[str, Any] = field(default_factory=_default_permit)
    shift: dict[str, Any] = field(default_factory=_default_shift)
    running: bool = False
    swat_row: int = 0
    ai4i_row: int = 0
    ticks: int = 0
    last_result: dict[str, Any] | None = None
    last_error: str | None = None
    _thread: threading.Thread | None = field(default=None, repr=False)
    _stop: threading.Event = field(default_factory=threading.Event, repr=False)
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)
    _swat_data: pd.DataFrame | None = field(default=None, repr=False)
    _ai4i_data: pd.DataFrame | None = field(default=None, repr=False)
    _capture: Any = field(default=None, repr=False)

    def _load_sources(self) -> None:
        for path, label in ((self.swat_csv, "SWaT CSV"), (self.ai4i_csv, "AI4I CSV"), (self.video_path, "PPE video")):
            if not path.is_file():
                raise FileNotFoundError(f"{label} not found: {path}")
        self._swat_data = pd.read_csv(self.swat_csv)
        self._ai4i_data = pd.read_csv(self.ai4i_csv)
        missing = [name for name in SwatAnomalyDetector.SENSOR_COLUMNS if name not in self._swat_data.columns]
        if missing:
            raise ValueError("SWaT replay CSV is missing sensor columns: " + ", ".join(missing))
        required_ai4i = ["Type", "Air temperature [K]", "Process temperature [K]", "Rotational speed [rpm]", "Torque [Nm]", "Tool wear [min]"]
        missing = [name for name in required_ai4i if name not in self._ai4i_data.columns]
        if missing:
            raise ValueError("AI4I replay CSV is missing columns: " + ", ".join(missing))
        self._open_video()

    def _open_video(self) -> None:
        if self._capture is not None:
            self._capture.release()
        self._capture = cv2.VideoCapture(str(self.video_path))
        if not self._capture.isOpened():
            raise RuntimeError(f"Cannot open PPE video: {self.video_path}")

    def _next_frame(self):
        if self._capture is None:
            self._open_video()
        ok, frame = self._capture.read()
        if ok:
            # Advance by approximately the configured wall-clock interval so
            # a 3-second tick shows a genuinely later video moment.
            fps = self._capture.get(cv2.CAP_PROP_FPS) or 0
            for _ in range(max(0, round(fps * self.interval_seconds) - 1)):
                if not self._capture.grab():
                    break
            return frame
        self._open_video()
        ok, frame = self._capture.read()
        if not ok:
            raise RuntimeError(f"PPE video contains no readable frames: {self.video_path}")
        return frame

    def _next_payload(self) -> dict[str, Any]:
        assert self._swat_data is not None and self._ai4i_data is not None
        swat = self._swat_data.iloc[self.swat_row % len(self._swat_data)]
        ai4i = self._ai4i_data.iloc[self.ai4i_row % len(self._ai4i_data)]
        self.swat_row += 1
        self.ai4i_row += 1
        return {
            "zone": self.zone,
            "swat": {"reading": {name: float(swat[name]) for name in SwatAnomalyDetector.SENSOR_COLUMNS}},
            "ai4i": {
                "air_temp": float(ai4i["Air temperature [K]"]),
                "process_temp": float(ai4i["Process temperature [K]"]),
                "rpm": float(ai4i["Rotational speed [rpm]"]),
                "torque": float(ai4i["Torque [Nm]"]),
                "tool_wear": float(ai4i["Tool wear [min]"]),
                "machine_type": str(ai4i["Type"]),
            },
            "ppe": {"frame": self._next_frame()},
            "permit": self.permit,
            "shift": self.shift,
        }

    def tick(self) -> dict[str, Any]:
        """Process exactly one real dataset/video event; useful for demo controls."""
        with self._lock:
            if self._swat_data is None:
                self._load_sources()
            payload = self._next_payload()
            # Feed the just-computed SWaT anomaly into the permit rule engine.
            # The executor runs SWaT before permit; its next pass has the same
            # persisted UI context and does not mutate the frozen model logic.
            result = Executor().run(Plan(agents=LIVE_AGENT_ORDER, reasoning="3-second replay tick."), payload)
            self.ticks += 1
            self.last_result = result
            self.last_error = None
            return result

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception as exc:  # noqa: BLE001
                with self._lock:
                    self.last_error = str(exc)
                self._stop.wait(self.interval_seconds)
                continue
            self._stop.wait(self.interval_seconds)
        with self._lock:
            self.running = False

    def start(self) -> None:
        with self._lock:
            if self.running:
                return
            self._load_sources()
            self._stop.clear()
            self.running = True
            self._thread = threading.Thread(target=self._loop, name=f"live-replay-{self.zone}", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        thread = self._thread
        if thread and thread is not threading.current_thread():
            thread.join(timeout=max(self.interval_seconds + 2, 5))
        with self._lock:
            self.running = False
            if self._capture is not None:
                self._capture.release()
                self._capture = None

    def update_context(self, permit: Mapping[str, Any] | None, shift: Mapping[str, Any] | None) -> None:
        with self._lock:
            if permit is not None:
                self.permit = dict(permit)
            if shift is not None:
                self.shift = dict(shift)

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "zone": self.zone, "running": self.running, "interval_seconds": self.interval_seconds,
                "ticks": self.ticks, "swat_row": self.swat_row, "ai4i_row": self.ai4i_row,
                "sources": {"swat_csv": str(self.swat_csv), "ai4i_csv": str(self.ai4i_csv), "video_path": str(self.video_path)},
                "last_result": self.last_result, "last_error": self.last_error,
            }


class LiveReplayManager:
    def __init__(self) -> None:
        self._sessions: dict[str, ReplaySession] = {}
        self._lock = threading.RLock()

    def start(self, *, zone: str, interval_seconds: float = 3.0, swat_csv: str | None = None,
              ai4i_csv: str | None = None, video_path: str | None = None,
              permit: Mapping[str, Any] | None = None, shift: Mapping[str, Any] | None = None,
              start_offset: int = 0) -> dict[str, Any]:
        if interval_seconds <= 0:
            raise ValueError("interval_seconds must be greater than zero.")
        if start_offset < 0:
            raise ValueError("start_offset must not be negative.")
        with self._lock:
            old = self._sessions.get(zone)
            if old is not None:
                old.stop()
            session = ReplaySession(
                zone=zone, interval_seconds=interval_seconds,
                swat_csv=Path(swat_csv) if swat_csv else PROJECT_ROOT / "swat" / "data" / "raw" / "preprocessed_swat_data.csv",
                ai4i_csv=Path(ai4i_csv) if ai4i_csv else PROJECT_ROOT / "ai4i2020.csv",
                video_path=Path(video_path) if video_path else PROJECT_ROOT / "vedio1.mp4",
                swat_row=start_offset,
                ai4i_row=start_offset,
            )
            session.update_context(permit, shift)
            self._sessions[zone] = session
            session.start()
            return session.status()

    def get(self, zone: str) -> ReplaySession:
        with self._lock:
            if zone not in self._sessions:
                raise KeyError(f"No live session exists for zone '{zone}'. Start it first.")
            return self._sessions[zone]

    def stop(self, zone: str) -> dict[str, Any]:
        session = self.get(zone)
        session.stop()
        return session.status()


LIVE_REPLAY = LiveReplayManager()
