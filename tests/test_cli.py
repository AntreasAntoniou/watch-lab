from __future__ import annotations

import pytest

from watchlab.cli import build_parser


def test_cli_has_no_demo_database_command() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args(["demo", "--database", "example.duckdb"])
