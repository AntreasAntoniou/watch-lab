from __future__ import annotations

import pytest

from watchlab.query import compile_query


def test_text_values_are_parameters_not_sql() -> None:
    compiled = compile_query(
        filters=[{"field": "primary_title", "operator": "contains", "value": "x' OR 1=1 --"}]
    )
    assert "OR 1=1" not in compiled.where_sql
    assert compiled.parameters == ["%x' OR 1=1 --%"]


def test_multi_sort_is_stable() -> None:
    compiled = compile_query(
        sorts=[
            {"field": "average_rating", "direction": "desc"},
            {"field": "num_votes", "direction": "desc"},
        ]
    )
    assert '"average_rating" DESC' in compiled.order_sql
    assert '"num_votes" DESC' in compiled.order_sql
    assert compiled.order_sql.endswith('"imdb_id" ASC')


def test_invalid_operator_is_rejected() -> None:
    with pytest.raises(ValueError, match="not valid"):
        compile_query(filters=[{"field": "num_votes", "operator": "contains", "value": 5}])
