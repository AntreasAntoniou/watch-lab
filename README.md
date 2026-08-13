# Watch Lab

Watch Lab is a live seasonal programming desk over AniList, MyAnimeList, TVmaze, and
optional TMDB, with a fast local IMDb research console underneath. Compare current anime
scores source by source, see what is airing on television, scan a seasonal movie window,
then search and filter millions of locally indexed titles without loading the catalogue
into browser memory.

The source is open, but the IMDb dataset is not redistributable. The public hosted
version therefore uses live public APIs plus clearly labelled fictional archive records;
the complete IMDb explorer runs locally after each user downloads the data directly from
IMDb.

## Live seasonal discovery

- **Anime:** AniList and MyAnimeList/Jikan are joined by MyAnimeList ID. Their scores remain
  separate and visible rather than being presented as one interchangeable rating.
- **Television:** TVmaze supplies broadcast and streaming premieres for the representative
  day in the selected season.
- **Movies:** TMDB supplies movies released inside the exact seasonal date window after a
  visitor provides an API Read Access Token. The token stays in `sessionStorage`, leaves
  when the tab closes, and is sent only to `api.themoviedb.org`.
- **Live updates:** refresh manually or leave the page open; visible pages refresh stale
  source data every 15 minutes.

The derived **pick score** adjusts each 0–100 source score toward a neutral 65 while its
audience evidence is small, then converges on the published rating as confidence grows.
It is a ranking aid, not an additional community rating. Raw source scores and audience
signals always remain visible.

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

Try the live zero-cost demo at
[antreas-watch-lab.static.hf.space](https://antreas-watch-lab.static.hf.space/). Its
deployment source is visible in the public
[Hugging Face Space](https://huggingface.co/spaces/Antreas/watch-lab/tree/main).

The hosted static demo exercises the live discovery desk and the canonical archive UI. The
archive uses the same filter/sort contract against 24 invented records; the container demo
additionally exercises FastAPI, DuckDB, and the Python query compiler. Synthetic identifiers
start with `demo-`, the interface displays a prominent fictional-data label, and title cells
do not link those records to IMDb. Its year range begins at `1874`, matching the earliest year
in the verified local IMDb snapshot rather than an arbitrary modern cutoff.

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

The image is provider-neutral. The zero-cost public deployment uses a Hugging Face Static
Space: a small browser adapter implements the same filter and sort contract over fictional
records while reusing the canonical interface. Build that projection with:

```bash
uv run python deploy/static/build.py /tmp/watch-lab-static
```

`deploy/huggingface/` also contains a Docker Space projection pinned to a Watch Lab release
tag. It can be enabled if CPU compute hosting is available on the target Hugging Face plan.
RunPod remains a viable container target if a future licensed or compute-heavy edition actually
benefits from its GPU/serverless model; it is unnecessary cost for this static public demo.

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

The tests build temporary local and synthetic databases, exercise the same API used by the
full dataset, and contract-test source normalization, seasonal selection, source joins,
confidence adjustment, credential transport, and the static deployment projection.

## Source terms and attribution

Watch Lab calls AniList's public GraphQL API, the unofficial Jikan API for MyAnimeList data,
and TVmaze's public API directly from the browser. TVmaze data is CC BY-SA and links back to
its source. TMDB access requires the visitor's own application token and is subject to TMDB's
terms and attribution requirements. Availability, rate limits, and upstream scores remain
controlled by those services.

## License

The Watch Lab source code is MIT licensed. IMDb data is not covered by that license and
remains subject to IMDb's terms.
