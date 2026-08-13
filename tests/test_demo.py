from __future__ import annotations

from pathlib import Path

from watchlab.cli import main
from watchlab.database import WatchDatabase
from watchlab.demo import build_demo_database


def test_demo_database_contains_only_clearly_fictional_identifiers(tmp_path: Path) -> None:
    database_path = build_demo_database(tmp_path / "demo.duckdb")
    database = WatchDatabase(database_path)
    try:
        result = database.query(
            search="",
            filters=[],
            sorts=[{"field": "num_votes", "direction": "desc"}],
            page=1,
            page_size=250,
        )
    finally:
        database.close()

    assert result["total"] >= 20
    assert all(row["imdb_id"].startswith("demo-") for row in result["rows"])
    assert all("IMDb" not in row["primary_title"] for row in result["rows"])


def test_demo_cli_builds_a_queryable_database_at_the_requested_path(tmp_path: Path) -> None:
    database_path = tmp_path / "nested" / "space.duckdb"

    main(["demo", "--database", str(database_path)])

    database = WatchDatabase(database_path)
    try:
        assert database.stats()["rated_titles"] == 24
    finally:
        database.close()


def test_demo_year_range_starts_at_the_earliest_catalogue_year(tmp_path: Path) -> None:
    database_path = build_demo_database(tmp_path / "demo.duckdb")
    database = WatchDatabase(database_path)
    try:
        stats = database.stats()
    finally:
        database.close()

    assert stats["earliest_year"] == 1874
