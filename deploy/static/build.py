from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[2]
CANONICAL_STATIC = REPOSITORY / "src" / "watchlab" / "static"
STATIC_OMIT_PATTERN = re.compile(
    r"\s*<!-- STATIC_OMIT_START -->.*?<!-- STATIC_OMIT_END -->",
    re.DOTALL,
)


def build_static_space(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    static_output = output / "static"
    static_output.mkdir(parents=True, exist_ok=True)

    index = (CANONICAL_STATIC / "index.html").read_text()
    if "<!-- STATIC_OMIT_START -->" not in index:
        raise RuntimeError("Static projection markers are missing from index.html")
    static_index = STATIC_OMIT_PATTERN.sub("", index).replace(
        '<span id="buildState">Reading live sources…</span>',
        '<span id="buildState">Live now</span>',
    )
    (output / "index.html").write_text(static_index)

    for name in ("discovery.js", "discovery-ui.js", "favicon.svg", "style.css"):
        shutil.copy2(CANONICAL_STATIC / name, static_output / name)
    shutil.copy2(Path(__file__).with_name("README.space.md"), output / "README.md")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the zero-cost Watch Lab Static Space")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build_static_space(args.output.resolve())


if __name__ == "__main__":
    main()
