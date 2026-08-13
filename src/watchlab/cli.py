from __future__ import annotations

import argparse
from collections.abc import Sequence

import uvicorn

from .download import download_all
from .ingest import build_database


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="watch-lab", description="Explore IMDb's non-commercial title datasets locally"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "build", "setup"):
        command = commands.add_parser(name)
        command.add_argument("--force", action="store_true")
    serve = commands.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--reload", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    if args.command == "fetch":
        download_all(force=args.force)
    elif args.command == "build":
        build_database(force=args.force)
    elif args.command == "setup":
        download_all(force=args.force)
        build_database(force=args.force)
    elif args.command == "serve":
        uvicorn.run("watchlab.api:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
