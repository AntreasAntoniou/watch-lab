# CHRONICLE

Curated narrative for this project. The complete trace — every file, command, and
prompt, with full content — lives in the chronicle ledger; `chron resume` reads it back.

**Append only.** Corrections reference the entry they supersede; nothing is ever edited.

---


## [2026-08-13T00:51Z-EG67] DECISION — Use a zero-compute browser federation for live seasonal discovery

- **State reading:** INTENTIONAL: independent source status and partial rendering when Jikan returns 429/504, balanced anime/TV cards, TMDB disconnected by default, IMDb data local. BUG: a provider failure blanking the whole page, any deployed/stored TMDB token, or any public IMDb-backed dataset.
- **Why:** AniList, Jikan, and TVmaze are CORS-enabled and need no embedded secret; TMDB requires application authentication, so a public Static Space must ask each visitor for a session-only read token. This preserves zero hosting cost and the IMDb non-redistribution boundary.


## [2026-08-13T03:26Z-CS3D] DECISION — Require genuine source data across Watch Lab

- **Intent:** Make NEVER demo data a repository and deployment invariant
- **What:** Removed the generated catalogue, browser mock transport, demo CLI and Docker fallback; the public static projection is live-source-only and containers require a mounted local IMDb database
- **Why:** A polished discovery product must preserve the provenance of every displayed title and fail visibly when an upstream source or licensed dataset is unavailable
- **Reversibility:** R1 — reversible only via a named artifact (snapshot, rollback tag, backup file)
- **Restore:** `Revert the implementation commit that records this decision`
- **Verified:** Python and JavaScript suites pass: 19 checks total
- **Verified:** Real local API and Docker container report 1,701,383 titles with earliest_year 1874
- **Verified:** Static build contains discovery assets and no archive transport
- **NOT done:** Movies remain unavailable until the visitor provides a real TMDB token

