from __future__ import annotations

import argparse
import shutil
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[2]
CANONICAL_STATIC = REPOSITORY / "src" / "watchlab" / "static"


def build_static_space(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    static_output = output / "static"
    static_output.mkdir(parents=True, exist_ok=True)

    index = (CANONICAL_STATIC / "index.html").read_text()
    canonical_script = '    <script src="/static/app.js" defer></script>'
    mock_and_app = (
        '    <script src="/static/mock-api.js"></script>\n'
        '    <script src="/static/app.js" defer></script>'
    )
    if canonical_script not in index:
        raise RuntimeError("Canonical app script marker is missing from index.html")
    (output / "index.html").write_text(index.replace(canonical_script, mock_and_app))

    for name in ("app.js", "favicon.svg", "style.css"):
        shutil.copy2(CANONICAL_STATIC / name, static_output / name)
    shutil.copy2(Path(__file__).with_name("mock-api.js"), static_output / "mock-api.js")
    shutil.copy2(Path(__file__).with_name("README.space.md"), output / "README.md")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the zero-cost Watch Lab Static Space")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build_static_space(args.output.resolve())


if __name__ == "__main__":
    main()
