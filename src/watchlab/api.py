from __future__ import annotations

import atexit
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import __version__
from .config import DATA_MODE, DATABASE_PATH, STATIC_DIR
from .database import WatchDatabase
from .schema import public_schema


class FilterSpec(BaseModel):
    field: str
    operator: str
    value: Any = None


class SortSpec(BaseModel):
    field: str
    direction: Literal["asc", "desc"] = "desc"


class QueryRequest(BaseModel):
    search: str = Field(default="", max_length=300)
    filters: list[FilterSpec] = Field(default_factory=list, max_length=20)
    sorts: list[SortSpec] = Field(default_factory=list, max_length=5)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=10, le=250)


def create_app(database_path: Path = DATABASE_PATH, data_mode: str = DATA_MODE) -> FastAPI:
    app = FastAPI(title="Watch Lab", version=__version__)
    database: WatchDatabase | None = None

    def get_database() -> WatchDatabase:
        nonlocal database
        if database is None:
            try:
                database = WatchDatabase(database_path)
                atexit.register(database.close)
            except FileNotFoundError as error:
                raise HTTPException(
                    status_code=503,
                    detail="Local database not found. Run `uv run watch-lab setup` first.",
                ) from error
        return database

    @app.get("/api/schema")
    def schema() -> dict[str, object]:
        return {"fields": public_schema()}

    @app.get("/api/stats")
    def stats() -> dict[str, Any]:
        return get_database().stats()

    @app.get("/api/about")
    def about() -> dict[str, object]:
        is_demo = data_mode == "synthetic_demo"
        notice = (
            "This public instance contains fictional demonstration records only."
            if is_demo
            else "This private instance uses a locally downloaded IMDb dataset."
        )
        return {"data_mode": data_mode, "is_demo": is_demo, "notice": notice}

    @app.get("/healthz")
    def health() -> dict[str, str]:
        get_database().stats()
        return {"status": "ok"}

    @app.post("/api/query")
    def query(request: QueryRequest) -> dict[str, Any]:
        try:
            return get_database().query(
                search=request.search,
                filters=[item.model_dump() for item in request.filters],
                sorts=[item.model_dump() for item in request.sorts],
                page=request.page,
                page_size=request.page_size,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    return app


app = create_app()
