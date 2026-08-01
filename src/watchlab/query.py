from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .schema import FIELD_MAP

TEXT_OPERATORS = {"contains", "not_contains", "starts_with", "eq", "neq", "in"}
NUMBER_OPERATORS = {"eq", "neq", "gt", "gte", "lt", "lte", "between"}
COMMON_OPERATORS = {"is_null", "not_null"}
BOOLEAN_OPERATORS = {"eq", "neq"}


@dataclass(frozen=True)
class CompiledQuery:
    where_sql: str
    parameters: list[Any]
    order_sql: str


def _column(field: str) -> str:
    if field not in FIELD_MAP:
        raise ValueError(f"Unknown field: {field}")
    return f'"{field}"'


def _compile_filter(item: dict[str, Any]) -> tuple[str, list[Any]]:
    field_key = str(item.get("field", ""))
    operator = str(item.get("operator", ""))
    field = FIELD_MAP.get(field_key)
    if field is None:
        raise ValueError(f"Unknown field: {field_key}")
    column = _column(field_key)

    if operator == "is_null":
        return f"{column} IS NULL", []
    if operator == "not_null":
        return f"{column} IS NOT NULL", []

    value = item.get("value")
    if field.kind == "text":
        if operator not in TEXT_OPERATORS:
            raise ValueError(f"Operator {operator!r} is not valid for {field.kind}")
        text = str(value or "")
        if operator == "contains":
            return f"lower(COALESCE({column}, '')) LIKE lower(?)", [f"%{text}%"]
        if operator == "not_contains":
            return f"lower(COALESCE({column}, '')) NOT LIKE lower(?)", [f"%{text}%"]
        if operator == "starts_with":
            return f"lower(COALESCE({column}, '')) LIKE lower(?)", [f"{text}%"]
        if operator == "in":
            values = [part.strip() for part in text.split(",") if part.strip()]
            if not values:
                raise ValueError("The 'in' operator needs at least one comma-separated value")
            placeholders = ", ".join("?" for _ in values)
            return f"lower({column}) IN ({placeholders})", [value.lower() for value in values]
        comparison = "=" if operator == "eq" else "<>"
        return f"lower({column}) {comparison} lower(?)", [text]

    if field.kind == "boolean":
        if operator not in BOOLEAN_OPERATORS:
            raise ValueError(f"Operator {operator!r} is not valid for {field.kind}")
        boolean = value if isinstance(value, bool) else str(value).lower() == "true"
        comparison = "=" if operator == "eq" else "<>"
        return f"{column} {comparison} ?", [boolean]

    if operator not in NUMBER_OPERATORS:
        raise ValueError(f"Operator {operator!r} is not valid for {field.kind}")
    if operator == "between":
        if not isinstance(value, list) or len(value) != 2:
            raise ValueError("The 'between' operator needs two values")
        return f"{column} BETWEEN ? AND ?", [value[0], value[1]]
    comparisons = {"eq": "=", "neq": "<>", "gt": ">", "gte": ">=", "lt": "<", "lte": "<="}
    return f"{column} {comparisons[operator]} ?", [value]


def compile_query(
    *, search: str = "", filters: list[dict[str, Any]] | None = None, sorts: list[dict[str, str]] | None = None
) -> CompiledQuery:
    clauses: list[str] = []
    parameters: list[Any] = []
    if search.strip():
        clauses.append(
            "(lower(primary_title) LIKE lower(?) OR lower(COALESCE(original_title, '')) "
            "LIKE lower(?) OR lower(imdb_id) LIKE lower(?))"
        )
        needle = f"%{search.strip()}%"
        parameters.extend([needle, needle, needle])

    for item in filters or []:
        clause, values = _compile_filter(item)
        clauses.append(clause)
        parameters.extend(values)

    order_parts: list[str] = []
    seen: set[str] = set()
    for sort in (sorts or [])[:5]:
        field = str(sort.get("field", ""))
        direction = str(sort.get("direction", "desc")).lower()
        if field in seen:
            continue
        if direction not in {"asc", "desc"}:
            raise ValueError(f"Invalid sort direction: {direction}")
        order_parts.append(f"{_column(field)} {direction.upper()} NULLS LAST")
        seen.add(field)
    if not order_parts:
        order_parts.append('"num_votes" DESC NULLS LAST')
    if "imdb_id" not in seen:
        order_parts.append('"imdb_id" ASC')

    return CompiledQuery(
        where_sql=(" WHERE " + " AND ".join(clauses)) if clauses else "",
        parameters=parameters,
        order_sql=" ORDER BY " + ", ".join(order_parts),
    )
