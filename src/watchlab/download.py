from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

from .config import DATA_DIR

BASE_URL = "https://datasets.imdbws.com"
DATASETS = ("title.basics.tsv.gz", "title.ratings.tsv.gz")
MANIFEST_NAME = "download-manifest.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, destination: Path) -> dict[str, str | int]:
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "watch-lab/0.1"})
    with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as out:
        total = int(response.headers.get("Content-Length", "0"))
        received = 0
        while chunk := response.read(1024 * 1024):
            out.write(chunk)
            received += len(chunk)
            if total:
                pct = received * 100 / total
                print(
                    f"\r{destination.name}: {received / 1_048_576:.1f} / "
                    f"{total / 1_048_576:.1f} MiB ({pct:.0f}%)",
                    end="",
                    file=sys.stderr,
                    flush=True,
                )
        print(file=sys.stderr)
        metadata: dict[str, str | int] = {
            "url": url,
            "size": received,
            "etag": response.headers.get("ETag", ""),
            "last_modified": response.headers.get("Last-Modified", ""),
        }
    os.replace(temporary, destination)
    metadata["sha256"] = sha256_file(destination)
    return metadata


def download_all(*, force: bool = False, data_dir: Path = DATA_DIR) -> Path:
    data_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = data_dir / MANIFEST_NAME
    old_manifest: dict[str, object] = {}
    if manifest_path.exists():
        old_manifest = json.loads(manifest_path.read_text())

    files: dict[str, object] = {}
    old_files = old_manifest.get("files", {})
    for filename in DATASETS:
        destination = data_dir / filename
        old_entry = old_files.get(filename, {}) if isinstance(old_files, dict) else {}
        expected_size = old_entry.get("size") if isinstance(old_entry, dict) else None
        if destination.exists() and not force and destination.stat().st_size == expected_size:
            expected_hash = old_entry.get("sha256") if isinstance(old_entry, dict) else None
            if expected_hash and sha256_file(destination) == expected_hash:
                print(f"Using verified {destination}")
                files[filename] = old_entry
                continue
        print(f"Downloading {filename} from IMDb", file=sys.stderr)
        files[filename] = _download(f"{BASE_URL}/{filename}", destination)

    manifest = {
        "fetched_at": datetime.now(UTC).isoformat(),
        "files": files,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest_path
