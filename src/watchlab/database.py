from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Any

import duckdb

from .query import compile_query
from .schema import FIELD_KEYS


class WatchDatabase:
    def __init__(self, path: Path):
        if not path.exists():
            raise FileNotFoundError(path)
        self.path = path
        self._connection = duckdb.connect(str(path), read_only=True)
        self._lock = threading.RLock()

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def query(
        self,
        *,
        search: str,
        filters: list[dict[str, Any]],
        sorts: list[dict[str, str]],
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        compiled = compile_query(search=search, filters=filters, sorts=sorts)
        offset = (page - 1) * page_size
        columns = ", ".join(f'"{key}"' for key in FIELD_KEYS)
        started = time.perf_counter()
        with self._lock:
            total = self._connection.execute(
                f"SELECT count(*) FROM titles{compiled.where_sql}", compiled.parameters
            ).fetchone()[0]
            result = self._connection.execute(
                f"SELECT {columns} FROM titles{compiled.where_sql}{compiled.order_sql} "
                "LIMIT ? OFFSET ?",
                [*compiled.parameters, page_size, offset],
            )
            rows = [dict(zip(FIELD_KEYS, row, strict=True)) for row in result.fetchall()]
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        return {
            "rows": rows,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": max(1, (total + page_size - 1) // page_size),
            "elapsed_ms": elapsed_ms,
        }

    def stats(self) -> dict[str, Any]:
        with self._lock:
            total, votes, earliest, latest = self._connection.execute(
                """
                SELECT count(*), sum(num_votes), min(start_year), max(start_year)
                FROM titles
                """
            ).fetchone()
            built_at = self._connection.execute(
                "SELECT built_at FROM dataset_metadata LIMIT 1"
            ).fetchone()[0]
        return {
            "rated_titles": total,
            "total_votes": votes,
            "earliest_year": earliest,
            "latest_year": latest,
            "built_at": built_at.isoformat() + "Z" if built_at else None,
        }
