from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_static_space_builder_outputs_live_discovery_without_archive_transport(
    tmp_path: Path,
) -> None:
    subprocess.run(
        [sys.executable, "deploy/static/build.py", str(tmp_path)],
        check=True,
        text=True,
    )

    index = (tmp_path / "index.html").read_text()
    assert 'id="discovery"' in index
    assert '<span id="buildState">Live now</span>' in index
    assert 'id="catalogue"' not in index
    assert "/static/app.js" not in index
    assert "mock-api" not in index
    assert not {"demo", "fictional", "synthetic"} & set(index.lower().split())
    assert (tmp_path / "README.md").is_file()
    assert (tmp_path / "static" / "style.css").is_file()
    assert (tmp_path / "static" / "favicon.svg").is_file()
    assert (tmp_path / "static" / "discovery.js").is_file()
    assert (tmp_path / "static" / "discovery-ui.js").is_file()
    assert not (tmp_path / "static" / "app.js").exists()
    assert not (tmp_path / "static" / "mock-api.js").exists()
