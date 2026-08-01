.PHONY: setup fetch build run test lint

setup:
	uv sync --extra dev
	uv run watch-lab setup

fetch:
	uv run watch-lab fetch

build:
	uv run watch-lab build

run:
	uv run watch-lab serve

test:
	uv run pytest

lint:
	uv run ruff check .
