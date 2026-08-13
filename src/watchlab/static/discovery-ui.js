(function initialiseDiscoveryUI() {
  const api = window.WatchLabDiscovery;
  if (!api) return;

  const $ = (selector) => document.querySelector(selector);
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const current = api.seasonForDate(new Date());
  const state = {
    year: current.year,
    season: current.season,
    kind: "all",
    sort: "pick",
    items: [],
    refreshedAt: null,
    generation: 0,
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const formatNumber = (value) => new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);

  function tmdbToken() {
    try { return window.sessionStorage.getItem("watchlab:tmdb-token") || ""; } catch { return ""; }
  }

  function representativeDate() {
    const [start, end] = api.seasonDateRange(state.year, state.season);
    const today = new Date().toISOString().slice(0, 10);
    if (today >= start && today <= end) return today;
    const middleMonth = { WINTER: "02", SPRING: "05", SUMMER: "08", FALL: "11" }[state.season];
    return `${state.year}-${middleMonth}-15`;
  }

  function setSource(source, status, detail = "") {
    const element = $(`[data-source="${source}"]`);
    if (!element) return;
    element.classList.remove("is-loading", "is-ready", "is-error", "is-offline");
    element.classList.add(`is-${status}`);
    if (detail) element.title = detail;
  }

  function renderSeason() {
    $("#seasonYear").textContent = state.year;
    const position = seasons.indexOf(state.season);
    $("#seasonTrack").style.setProperty("--season-position", position);
    document.querySelectorAll("#seasonTrack button").forEach((button) => {
      const active = button.dataset.season === state.season;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const label = state.season === "FALL" ? "Autumn" : state.season[0] + state.season.slice(1).toLowerCase();
    $("#seasonStatus").textContent = `${label} ${state.year} · TV snapshot ${representativeDate()}`;
  }

  function renderLoading() {
    $("#discoveryGrid").setAttribute("aria-busy", "true");
    $("#discoveryGrid").innerHTML = Array.from({ length: 8 }, () => `
      <article class="programme-card skeleton-card" aria-hidden="true">
        <div class="programme-poster"></div><div class="skeleton-lines"><i></i><i></i><i></i></div>
      </article>`).join("");
  }

  function rawRating(item) {
    if (!item.ratings?.length) return 0;
    return item.ratings.reduce((sum, rating) => sum + rating.score, 0) / item.ratings.length;
  }

  function audience(item) {
    return Math.max(item.popularity || 0, ...(item.ratings || []).map((rating) => rating.count || 0));
  }

  function sortedItems() {
    const items = state.kind === "all" ? [...state.items] : state.items.filter((item) => item.kind === state.kind);
    const compare = {
      pick: (item) => item.pickScore || 0,
      rating: rawRating,
      audience,
      date: (item) => Number((item.nextDate || `${item.year || 0}-01-01`).replaceAll("-", "")),
    }[state.sort];
    const sorted = items.sort((left, right) => compare(right) - compare(left));
    return state.kind === "all" ? api.balanceMediaKinds(sorted) : sorted;
  }

  function mediaLabel(item) {
    if (item.kind === "anime") return [item.format, item.episodes ? `${item.episodes} eps` : null].filter(Boolean).join(" · ");
    if (item.kind === "tv") return [item.network, item.nextDate ? `Next ${item.nextDate}` : null].filter(Boolean).join(" · ");
    return ["Movie", item.nextDate || item.year].filter(Boolean).join(" · ");
  }

  function renderCard(item, index) {
    const ratings = (item.ratings || []).map((rating) => `
      <span class="source-rating"><b>${Math.round(rating.score)}</b><small>${escapeHtml(rating.source)}</small></span>`).join("");
    const links = (item.links || []).map((link) => `
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.source)} ↗</a>`).join("");
    const genres = (item.genres || []).slice(0, 3).map((genre) => `<span>${escapeHtml(genre)}</span>`).join("");
    const image = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async">`
      : `<div class="poster-fallback"><span>WATCH/LAB</span></div>`;
    const pick = item.pickScore ?? "—";
    return `
      <article class="programme-card" style="--delay:${Math.min(index, 12) * 35}ms;--card-accent:${escapeHtml(item.colour || "#7ddae8")}">
        <div class="programme-poster">
          ${image}
          <span class="media-kind">${escapeHtml(item.kind)}</span>
          <div class="pick-score" aria-label="Pick score ${pick}"><b>${pick}</b><small>pick</small></div>
        </div>
        <div class="programme-copy">
          <p class="programme-meta">${escapeHtml(mediaLabel(item))}</p>
          <h3>${escapeHtml(item.title)}</h3>
          ${item.originalTitle && item.originalTitle !== item.title ? `<p class="original-title">${escapeHtml(item.originalTitle)}</p>` : ""}
          <div class="rating-row">${ratings || '<span class="rating-pending">Not scored yet</span>'}</div>
          <div class="genre-row">${genres}</div>
          <div class="programme-footer"><span>${formatNumber(audience(item))} audience signal</span><span class="programme-links">${links}</span></div>
        </div>
      </article>`;
  }

  function renderTmdbPrompt() {
    return `
      <button class="connect-card" type="button" data-connect-tmdb>
        <span class="connect-mark">M</span>
        <strong>Connect live movies</strong>
        <small>Add a TMDB read token for this tab. Nothing is stored by Watch Lab.</small>
        <i>Connect TMDB →</i>
      </button>`;
  }

  function render() {
    const counts = {
      anime: state.items.filter((item) => item.kind === "anime").length,
      tv: state.items.filter((item) => item.kind === "tv").length,
      movie: state.items.filter((item) => item.kind === "movie").length,
    };
    $("#countAll").textContent = counts.anime + counts.tv + counts.movie;
    $("#countAnime").textContent = counts.anime;
    $("#countTv").textContent = counts.tv;
    $("#countMovie").textContent = counts.movie;

    const items = sortedItems();
    const needsMoviePrompt = !tmdbToken() && ["all", "movie"].includes(state.kind);
    $("#discoveryGrid").innerHTML = [
      ...items.slice(0, 16).map(renderCard),
      ...(needsMoviePrompt ? [renderTmdbPrompt()] : []),
    ].join("");
    $("#discoveryGrid").setAttribute("aria-busy", "false");
    $("#discoveryEmpty").hidden = items.length > 0 || needsMoviePrompt;
    $("#lastUpdated").textContent = state.refreshedAt
      ? `Updated ${state.refreshedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
      : "Live sources unavailable";
  }

  async function refresh() {
    const generation = ++state.generation;
    renderSeason();
    renderLoading();
    ["anilist", "mal", "tvmaze"].forEach((source) => setSource(source, "loading"));
    setSource("tmdb", tmdbToken() ? "loading" : "offline", tmdbToken() ? "Refreshing TMDB" : "Connect a read token");
    $("#refreshDiscovery").disabled = true;
    $("#refreshDiscovery").textContent = "Refreshing…";

    const date = representativeDate();
    const [startDate, endDate] = api.seasonDateRange(state.year, state.season);
    const jobs = [
      api.fetchAniListSeason({ year: state.year, season: state.season }),
      api.fetchJikanSeason({ year: state.year, season: state.season }),
      api.fetchTvMazeDay({ date }),
      tmdbToken() ? api.fetchTmdbMovies({ token: tmdbToken(), startDate, endDate }) : Promise.resolve([]),
    ];
    const [aniList, jikan, tvmaze, tmdb] = await Promise.allSettled(jobs);
    if (generation !== state.generation) return;

    setSource("anilist", aniList.status === "fulfilled" ? "ready" : "error", aniList.reason?.message);
    setSource("mal", jikan.status === "fulfilled" ? "ready" : "error", jikan.reason?.message);
    setSource("tvmaze", tvmaze.status === "fulfilled" ? "ready" : "error", tvmaze.reason?.message);
    if (tmdbToken()) setSource("tmdb", tmdb.status === "fulfilled" ? "ready" : "error", tmdb.reason?.message);

    const anime = api.mergeAnimeSources(
      aniList.status === "fulfilled" ? aniList.value : [],
      jikan.status === "fulfilled" ? jikan.value : [],
    ).map((item) => ({ ...item, kind: "anime" }));
    const tv = tvmaze.status === "fulfilled"
      ? api.normaliseTvMazeSchedule(tvmaze.value).map((item) => ({ ...item, kind: "tv" }))
      : [];
    const movies = tmdb.status === "fulfilled"
      ? api.normaliseTmdbMovies(tmdb.value).map((item) => ({ ...item, kind: "movie" }))
      : [];
    state.items = [...anime, ...tv, ...movies];
    state.refreshedAt = new Date();
    $("#refreshDiscovery").disabled = false;
    $("#refreshDiscovery").textContent = "Refresh live";
    render();
  }

  $("#seasonTrack").addEventListener("click", (event) => {
    const season = event.target.closest("button")?.dataset.season;
    if (!season || season === state.season) return;
    state.season = season;
    refresh();
  });
  $("#previousYear").addEventListener("click", () => { state.year -= 1; refresh(); });
  $("#nextYear").addEventListener("click", () => { state.year += 1; refresh(); });
  $("#mediaTabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-kind]");
    if (!button) return;
    state.kind = button.dataset.kind;
    document.querySelectorAll("#mediaTabs button").forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  });
  $("#discoverySort").addEventListener("change", (event) => { state.sort = event.target.value; render(); });
  $("#refreshDiscovery").addEventListener("click", refresh);

  const dialog = $("#tmdbDialog");
  function openTmdbDialog() {
    $("#tmdbToken").value = tmdbToken();
    dialog.showModal();
    $("#tmdbToken").focus();
  }
  $("#connectTmdb").addEventListener("click", openTmdbDialog);
  $("#discoveryGrid").addEventListener("click", (event) => {
    if (event.target.closest("[data-connect-tmdb]")) openTmdbDialog();
  });
  $("#saveTmdbToken").addEventListener("click", () => {
    const token = $("#tmdbToken").value.trim();
    if (!token) { $("#tmdbToken").focus(); return; }
    try { window.sessionStorage.setItem("watchlab:tmdb-token", token); } catch { return; }
    $("#connectTmdb").textContent = "TMDB · connected";
    dialog.close();
    refresh();
  });

  renderSeason();
  refresh();
  window.setInterval(() => {
    if (!document.hidden && (!state.refreshedAt || Date.now() - state.refreshedAt.getTime() >= 15 * 60 * 1000)) refresh();
  }, 60 * 1000);
})();
