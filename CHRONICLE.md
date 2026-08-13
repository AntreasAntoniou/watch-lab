# CHRONICLE

Curated narrative for this project. The complete trace — every file, command, and
prompt, with full content — lives in the chronicle ledger; `chron resume` reads it back.

**Append only.** Corrections reference the entry they supersede; nothing is ever edited.

---


## [2026-08-13T00:51Z-EG67] DECISION — Use a zero-compute browser federation for live seasonal discovery

- **State reading:** INTENTIONAL: independent source status and partial rendering when Jikan returns 429/504, balanced anime/TV cards, TMDB disconnected by default, IMDb data local. BUG: a provider failure blanking the whole page, any deployed/stored TMDB token, or any public IMDb-backed dataset.
- **Why:** AniList, Jikan, and TVmaze are CORS-enabled and need no embedded secret; TMDB requires application authentication, so a public Static Space must ask each visitor for a session-only read token. This preserves zero hosting cost and the IMDb non-redistribution boundary.

