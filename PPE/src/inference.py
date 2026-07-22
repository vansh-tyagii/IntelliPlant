"""Image, video, webcam, and RTSP runner for ``detector.process_frame``."""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

import cv2

from detector import process_frame


def _source(value: str) -> int | str:
    return int(value) if value.isdecimal() else value


def run(source: int | str, output: Path | None, show: bool) -> None:
    image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    if isinstance(source, str) and Path(source).suffix.casefold() in image_extensions:
        frame = cv2.imread(source)
        if frame is None: raise FileNotFoundError(f"Cannot read image: {source}")
        annotated, report = process_frame(frame)
        destination = output or Path(source).with_name(f"{Path(source).stem}_annotated.jpg")
        if not cv2.imwrite(str(destination), annotated): raise OSError(f"Cannot write image: {destination}")
        print(json.dumps(report, indent=2))
        if show: cv2.imshow("PPE Detection", annotated); cv2.waitKey(0); cv2.destroyAllWindows()
        return
    capture = cv2.VideoCapture(source)
    if not capture.isOpened(): raise RuntimeError(f"Cannot open source: {source}")
    writer = None
    try:
        while True:
            ok, frame = capture.read()
            if not ok: break
            annotated, report = process_frame(frame)
            if output and writer is None:
                output.parent.mkdir(parents=True, exist_ok=True)
                writer = cv2.VideoWriter(str(output), cv2.VideoWriter_fourcc(*"mp4v"), capture.get(cv2.CAP_PROP_FPS) or 25, (annotated.shape[1], annotated.shape[0]))
            if writer: writer.write(annotated)
            print(json.dumps(report))
            if show:
                cv2.imshow("PPE Detection", annotated)
                if cv2.waitKey(1) & 0xFF in (27, ord("q")): break
    finally:
        capture.release()
        if writer: writer.release()
        cv2.destroyAllWindows()


def main() -> None:
    parser = argparse.ArgumentParser(description="Local PPE inference")
    parser.add_argument("--source", default="0", help="camera index, image/video path, or RTSP URL")
    parser.add_argument("--output", type=Path, help="optional annotated image/video")
    parser.add_argument("--model", type=Path, help="local best.pt; sets PPE_MODEL_PATH")
    parser.add_argument("--no-show", action="store_true")
    args = parser.parse_args()
    if args.model: os.environ["PPE_MODEL_PATH"] = str(args.model)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    run(_source(args.source), args.output, not args.no_show)


if __name__ == "__main__": main()
