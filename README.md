# Watch Lab

Watch Lab is a live seasonal programming desk over AniList, MyAnimeList, TVmaze, and
optional TMDB, with a fast local IMDb research console underneath. Compare current anime
scores source by source, see what is airing on television, scan a seasonal movie window,
then search and filter millions of locally indexed titles without loading the catalogue
into browser memory.

The source is open, but the IMDb dataset is not redistributable. The public hosted version
therefore contains only records fetched live from its named upstream sources. The complete
IMDb explorer runs locally after each user downloads the data directly from IMDb. Watch Lab
has no generated catalogue, placeholder titles, or fallback records.

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

## Public app

Use the live zero-cost app at
[antreas-watch-lab.static.hf.space](https://antreas-watch-lab.static.hf.space/). Its
deployment source is visible in the public
[Hugging Face Space](https://huggingface.co/spaces/Antreas/watch-lab/tree/main).

The hosted static app is discovery-only: it fetches AniList, MyAnimeList/Jikan, and TVmaze
records in the visitor's browser, and fetches TMDB movies only after the visitor connects a
TMDB read token. If an upstream source is unavailable, Watch Lab reports that source as
unavailable; it does not manufacture replacements.

The Docker image exposes the local IMDb explorer on port 7860 and refuses to start without
a genuine database built by `watch-lab setup`:

```bash
docker build -t watch-lab .
docker run --rm -p 7860:7860 \
  --mount type=bind,src="$PWD/data",dst=/data,readonly \
  watch-lab
```

The image is provider-neutral. The zero-cost public deployment uses a Hugging Face Static
Space and deliberately omits the IMDb archive transport and interface. Build that projection
with:

```bash
uv run python deploy/static/build.py /tmp/watch-lab-static
```

RunPod remains a viable container target for a future licensed or compute-heavy edition, but
it is unnecessary cost for the live browser application. A hosted IMDb edition would require
separate redistribution rights; compute hosting does not change that licensing boundary.

## Why the data is not committed

IMDb makes these files available for personal and non-commercial use and allows individual
local copies, but its terms prohibit republishing or repurposing them to create an online or
offline movie database except for individual personal use. Watch Lab therefore keeps
everything under `data/` out of Git and out of the public app. Each local user downloads a
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

The tests build a temporary fixture database, exercise the same API used by the full dataset,
and contract-test source normalization, seasonal selection, source joins, confidence
adjustment, credential transport, and the discovery-only static deployment projection.

## Source terms and attribution

Watch Lab calls AniList's public GraphQL API, the unofficial Jikan API for MyAnimeList data,
and TVmaze's public API directly from the browser. TVmaze data is CC BY-SA and links back to
its source. TMDB access requires the visitor's own application token and is subject to TMDB's
terms and attribution requirements. Availability, rate limits, and upstream scores remain
controlled by those services.

## License

The Watch Lab source code is MIT licensed. IMDb data is not covered by that license and
remains subject to IMDb's terms.
