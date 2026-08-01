from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Field:
    key: str
    label: str
    kind: str
    nullable: bool = True


FIELDS = (
    Field("imdb_id", "IMDb ID", "text", False),
    Field("primary_title", "Primary title", "text", False),
    Field("original_title", "Original title", "text"),
    Field("title_type", "Title type", "text"),
    Field("start_year", "Start year", "number"),
    Field("end_year", "End year", "number"),
    Field("runtime_minutes", "Runtime (min)", "number"),
    Field("genres", "Genres", "text"),
    Field("average_rating", "IMDb rating", "number", False),
    Field("num_votes", "Votes", "number", False),
    Field("is_adult", "Adult title", "boolean"),
)

FIELD_MAP = {field.key: field for field in FIELDS}
FIELD_KEYS = tuple(FIELD_MAP)


def public_schema() -> list[dict[str, str | bool]]:
    return [asdict(field) for field in FIELDS]
