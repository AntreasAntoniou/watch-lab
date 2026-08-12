from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("WATCH_LAB_DATA_DIR", PROJECT_ROOT / "data")).resolve()
DATABASE_PATH = Path(os.environ.get("WATCH_LAB_DB", DATA_DIR / "watch-lab.duckdb")).resolve()
DATA_MODE = os.environ.get("WATCH_LAB_DATA_MODE", "local_imdb")
STATIC_DIR = Path(__file__).resolve().parent / "static"
