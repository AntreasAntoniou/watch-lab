from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

import duckdb

from .config import DATA_DIR, DATABASE_PATH
from .download import MANIFEST_NAME


def _sql_path(path: Path) -> str:
    return str(path).replace("'", "''")


def build_database(
    *, data_dir: Path = DATA_DIR, database_path: Path = DATABASE_PATH, force: bool = False
) -> Path:
    basics = data_dir / "title.basics.tsv.gz"
    ratings = data_dir / "title.ratings.tsv.gz"
    missing = [str(path) for path in (basics, ratings) if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing source dataset(s): " + ", ".join(missing))
    if database_path.exists() and not force:
        print(f"Using existing database {database_path}; pass --force to rebuild")
        return database_path

    database_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = database_path.with_suffix(".building.duckdb")
    temporary.unlink(missing_ok=True)
    connection = duckdb.connect(str(temporary))
    try:
        print("Building the local title index. This may take a few minutes…")
        connection.execute(
            f"""
            CREATE TABLE titles AS
            WITH basics AS (
                SELECT *
                FROM read_csv(
                    '{_sql_path(basics)}',
                    delim = '\t',
                    header = true,
                    all_varchar = true,
                    nullstr = '\\N',
                    quote = ''
                )
            ), ratings AS (
                SELECT *
                FROM read_csv(
                    '{_sql_path(ratings)}',
                    delim = '\t',
                    header = true,
                    all_varchar = true,
                    nullstr = '\\N',
                    quote = ''
                )
            )
            SELECT
                r.tconst AS imdb_id,
                b.primaryTitle AS primary_title,
                b.originalTitle AS original_title,
                b.titleType AS title_type,
                TRY_CAST(b.startYear AS INTEGER) AS start_year,
                TRY_CAST(b.endYear AS INTEGER) AS end_year,
                TRY_CAST(b.runtimeMinutes AS INTEGER) AS runtime_minutes,
                b.genres,
                TRY_CAST(r.averageRating AS DOUBLE) AS average_rating,
                TRY_CAST(r.numVotes AS BIGINT) AS num_votes,
                TRY_CAST(b.isAdult AS BOOLEAN) AS is_adult
            FROM ratings r
            INNER JOIN basics b ON b.tconst = r.tconst
            """
        )
        connection.execute("CREATE INDEX idx_titles_id ON titles(imdb_id)")
        connection.execute("CREATE INDEX idx_titles_rating ON titles(average_rating)")
        connection.execute("CREATE INDEX idx_titles_votes ON titles(num_votes)")
        connection.execute("CREATE INDEX idx_titles_year ON titles(start_year)")
        connection.execute("ANALYZE titles")

        manifest_path = data_dir / MANIFEST_NAME
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        connection.execute(
            """
            CREATE TABLE dataset_metadata (
                built_at TIMESTAMP,
                source_manifest JSON,
                row_count BIGINT
            )
            """
        )
        row_count = connection.execute("SELECT count(*) FROM titles").fetchone()[0]
        connection.execute(
            "INSERT INTO dataset_metadata VALUES (?, ?, ?)",
            [datetime.now(UTC).replace(tzinfo=None), json.dumps(manifest), row_count],
        )
        print(f"Indexed {row_count:,} rated titles")
    finally:
        connection.close()
    os.replace(temporary, database_path)
    print(f"Database ready: {database_path}")
    return database_path
