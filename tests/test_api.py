from __future__ import annotations

from fastapi.testclient import TestClient


def test_schema_exposes_every_sortable_field(client: TestClient) -> None:
    response = client.get("/api/schema")
    assert response.status_code == 200
    keys = {field["key"] for field in response.json()["fields"]}
    assert {"primary_title", "average_rating", "num_votes", "genres"} <= keys


def test_query_combines_search_filter_and_sort(client: TestClient) -> None:
    response = client.post(
        "/api/query",
        json={
            "search": "light",
            "filters": [{"field": "num_votes", "operator": "gte", "value": 1000}],
            "sorts": [{"field": "start_year", "direction": "desc"}],
            "page": 1,
            "page_size": 25,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert [row["primary_title"] for row in payload["rows"]] == ["The Lighthouse", "Moonlight"]


def test_between_and_null_filters(client: TestClient) -> None:
    between = client.post(
        "/api/query",
        json={
            "filters": [{"field": "average_rating", "operator": "between", "value": [7, 8]}],
            "page_size": 25,
        },
    )
    assert between.status_code == 200
    assert between.json()["total"] == 2

    missing_year = client.post(
        "/api/query",
        json={
            "filters": [{"field": "start_year", "operator": "is_null"}],
            "page_size": 25,
        },
    )
    assert missing_year.status_code == 200
    assert missing_year.json()["rows"][0]["primary_title"] == "Archive X"


def test_rejects_unknown_columns(client: TestClient) -> None:
    response = client.post(
        "/api/query",
        json={"sorts": [{"field": "drop_table", "direction": "asc"}], "page_size": 25},
    )
    assert response.status_code == 400
    assert "Unknown field" in response.json()["detail"]
