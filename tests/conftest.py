from __future__ import annotations

from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient

from watchlab.api import create_app


@pytest.fixture
def database_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.duckdb"
    connection = duckdb.connect(str(path))
    connection.execute(
        """
        CREATE TABLE titles (
            imdb_id VARCHAR,
            primary_title VARCHAR,
            original_title VARCHAR,
            title_type VARCHAR,
            start_year INTEGER,
            end_year INTEGER,
            runtime_minutes INTEGER,
            genres VARCHAR,
            average_rating DOUBLE,
            num_votes BIGINT,
            is_adult BOOLEAN
        );
        INSERT INTO titles VALUES
          ('tt001', 'The Lighthouse', 'The Lighthouse', 'movie', 2019, NULL, 109, 'Drama,Fantasy,Horror', 7.4, 260000, false),
          ('tt002', 'Moonlight', 'Moonlight', 'movie', 2016, NULL, 111, 'Drama', 7.4, 350000, false),
          ('tt003', 'Night Signal', 'Night Signal', 'short', 2024, NULL, 12, NULL, 8.1, 42, false),
          ('tt004', 'Archive X', 'Archive X', 'video', NULL, NULL, NULL, 'Documentary', 5.2, 8, true);
        CREATE TABLE dataset_metadata AS
        SELECT TIMESTAMP '2026-08-01 12:00:00' AS built_at, '{}'::JSON AS source_manifest, 4::BIGINT AS row_count;
        """
    )
    connection.close()
    return path


@pytest.fixture
def client(database_path: Path) -> TestClient:
    with TestClient(create_app(database_path)) as test_client:
        yield test_client
