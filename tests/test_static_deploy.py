from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_static_space_builder_injects_mock_transport_before_canonical_app(tmp_path: Path) -> None:
    subprocess.run(
        [sys.executable, "deploy/static/build.py", str(tmp_path)],
        check=True,
        text=True,
    )

    index = (tmp_path / "index.html").read_text()
    assert index.index('/static/mock-api.js') < index.index('/static/app.js')
    assert (tmp_path / "README.md").is_file()
    assert (tmp_path / "static" / "style.css").is_file()
    assert (tmp_path / "static" / "favicon.svg").is_file()
