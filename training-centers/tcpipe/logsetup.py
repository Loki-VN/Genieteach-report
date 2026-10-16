"""Log ra console + logs/pipeline.log; lỗi (WARNING trở lên) ghi thêm vào logs/errors.log."""
from __future__ import annotations

import logging
from pathlib import Path

FMT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def setup_logging(log_dir: Path, level: int = logging.INFO) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(level)
    for h in list(root.handlers):
        root.removeHandler(h)
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter(FMT))
    full = logging.FileHandler(log_dir / "pipeline.log", encoding="utf-8")
    full.setFormatter(logging.Formatter(FMT))
    errors = logging.FileHandler(log_dir / "errors.log", encoding="utf-8")
    errors.setLevel(logging.WARNING)
    errors.setFormatter(logging.Formatter(FMT))
    for h in (console, full, errors):
        root.addHandler(h)
    logging.getLogger("httpx").setLevel(logging.WARNING)
