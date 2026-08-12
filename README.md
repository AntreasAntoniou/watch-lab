# Watch Lab

Watch Lab turns IMDb's daily title and aggregate-rating datasets into a fast local
research console. Search titles, compose typed filters over every available field,
apply multiple sort keys, and move through millions of records without loading the
whole dataset into the browser.

The source is open, but the IMDb dataset is not redistributable. The public hosted
version therefore uses clearly labelled fictional records; the complete IMDb explorer
runs locally after each user downloads the data directly from IMDb.

## What you can explore

- IMDb ID, primary title, and original title
- title type and adult-content flag
- start year, end year, runtime, and genres
- weighted IMDb rating and number of votes
- free-text title search
- any combination of numeric, text, null, and Boolean filters
- up to five sort keys, in either direction

## Quick start

You need Python 3.11+ and [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/AntreasAntoniou/watch-lab.git
cd watch-lab
uv sync --extra dev
uv run watch-lab setup
uv run watch-lab serve
```

Open <http://127.0.0.1:8765>. `setup` downloads `title.basics.tsv.gz` and
`title.ratings.tsv.gz`, then builds `data/watch-lab.duckdb`. Downloads are resumable
at the command level: existing verified files are reused unless you pass `--force`.

```bash
uv run watch-lab fetch --force
uv run watch-lab build --force
uv run watch-lab serve --port 9000
```

The compressed source files are currently roughly 235 MB together. Allow additional
space for the local DuckDB database.

## Public demo

The hosted demo exercises the real FastAPI, DuckDB, query compiler, and browser UI against
24 invented records. Synthetic identifiers start with `demo-`, the interface displays a
prominent fictional-data label, and title cells do not link those records to IMDb.

Run that same safe mode locally:

```bash
uv run watch-lab demo --database /tmp/watch-lab-demo.duckdb
WATCH_LAB_DATA_MODE=synthetic_demo \
WATCH_LAB_DB=/tmp/watch-lab-demo.duckdb \
uv run watch-lab serve
```

The Docker image defaults to synthetic mode and exposes port 7860:

```bash
docker build -t watch-lab .
docker run --rm -p 7860:7860 watch-lab
```

The image is provider-neutral, but the public deployment targets Hugging Face CPU Basic:
the application needs CPU and a small ephemeral DuckDB file, not a GPU. The Space is a thin
projection pinned to a Watch Lab release tag. RunPod remains a viable container target if a
future licensed or compute-heavy edition actually benefits from its GPU/serverless model.

## Why the data is not committed

IMDb makes these files available for personal and non-commercial use and allows individual
local copies, but its terms prohibit republishing or repurposing them to create an online or
offline movie database except for individual personal use. Watch Lab therefore keeps
everything under `data/` out of Git and out of the public demo. Each local user downloads a
current copy directly from IMDb.

Please review IMDb's current [non-commercial dataset documentation](https://developer.imdb.com/non-commercial-datasets/)
and [licensing conditions](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX).

Information courtesy of IMDb (https://www.imdb.com). Used with permission.

## Architecture

```text
IMDb daily TSV.GZ files
        │  watch-lab setup
        ▼
local DuckDB database
        │  typed, parameterized SQL
        ▼
FastAPI JSON API ─── browser research console
```

Filtering and pagination happen in DuckDB, rather than in browser memory. Field names
and operators are allowlisted and values are SQL parameters, so the flexible query UI
does not interpolate arbitrary SQL.

## Development

```bash
uv sync --extra dev
uv run pytest
uv run ruff check .
```

The tests build temporary local and synthetic databases and exercise the same API used by
the full dataset.

## License

The Watch Lab source code is MIT licensed. IMDb data is not covered by that license and
remains subject to IMDb's terms.
