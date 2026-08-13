(function exposeDiscovery(root) {
  const NEUTRAL_SCORE = 65;
  const ANI_URL = "https://graphql.anilist.co";
  const JIKAN_URL = "https://api.jikan.moe/v4";
  const TVMAZE_URL = "https://api.tvmaze.com";
  const TMDB_URL = "https://api.themoviedb.org/3";

  function seasonForDate(date = new Date()) {
    const month = date.getUTCMonth() + 1;
    const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
    return { year: date.getUTCFullYear(), season };
  }

  function seasonDateRange(year, season) {
    const ranges = {
      WINTER: [`${year}-01-01`, `${year}-03-31`],
      SPRING: [`${year}-04-01`, `${year}-06-30`],
      SUMMER: [`${year}-07-01`, `${year}-09-30`],
      FALL: [`${year}-10-01`, `${year}-12-31`],
    };
    return ranges[season];
  }

  function confidenceAdjustedScore(ratings) {
    const usable = ratings.filter((rating) => Number.isFinite(rating.score));
    if (!usable.length) return null;
    const adjusted = usable.map((rating) => {
      const count = Math.max(0, Number(rating.count) || 0);
      const confidence = 1 - Math.exp(-count / 10000);
      return NEUTRAL_SCORE + (rating.score - NEUTRAL_SCORE) * confidence;
    });
    return Math.round(adjusted.reduce((sum, value) => sum + value, 0) / adjusted.length);
  }

  function balanceMediaKinds(items) {
    const lanes = ["anime", "tv", "movie"].map((kind) => items.filter((item) => item.kind === kind));
    const balanced = [];
    while (lanes.some((lane) => lane.length)) {
      for (const lane of lanes) {
        if (lane.length) balanced.push(lane.shift());
      }
    }
    return [...balanced, ...items.filter((item) => !["anime", "tv", "movie"].includes(item.kind))];
  }

  function animeFromAniList(item) {
    const ratings = Number.isFinite(item.averageScore)
      ? [{ source: "AniList", score: item.averageScore, count: item.popularity || 0 }]
      : [];
    return {
      key: item.idMal ? `mal:${item.idMal}` : `anilist:${item.id}`,
      malId: item.idMal || null,
      title: item.title?.english || item.title?.romaji || item.title?.native || "Untitled",
      originalTitle: item.title?.romaji || item.title?.native || null,
      image: item.coverImage?.extraLarge || item.coverImage?.large || null,
      colour: item.coverImage?.color || null,
      year: item.seasonYear || null,
      season: item.season || null,
      format: item.format || null,
      episodes: item.episodes || null,
      genres: item.genres || [],
      status: item.status || null,
      nextDate: item.nextAiringEpisode?.airingAt
        ? new Date(item.nextAiringEpisode.airingAt * 1000).toISOString().slice(0, 10)
        : null,
      nextEpisode: item.nextAiringEpisode?.episode || null,
      ratings,
      popularity: item.popularity || 0,
      favourites: item.favourites || 0,
      links: [{ source: "AniList", url: item.siteUrl }].filter((link) => link.url),
      sources: ["AniList"],
    };
  }

  function animeFromJikan(item) {
    const ratings = item.score
      ? [{ source: "MyAnimeList", score: Number((item.score * 10).toFixed(1)), count: item.scored_by || 0 }]
      : [];
    return {
      key: `mal:${item.mal_id}`,
      malId: item.mal_id,
      title: item.title_english || item.title || item.title_japanese || "Untitled",
      originalTitle: item.title || item.title_japanese || null,
      image: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || null,
      colour: null,
      year: item.year || item.aired?.prop?.from?.year || null,
      season: item.season?.toUpperCase() || null,
      format: item.type || null,
      episodes: item.episodes || null,
      genres: (item.genres || []).map((genre) => genre.name),
      status: item.status || null,
      nextDate: null,
      nextEpisode: null,
      ratings,
      popularity: item.members || 0,
      favourites: item.favorites || 0,
      links: [{ source: "MyAnimeList", url: item.url }].filter((link) => link.url),
      sources: ["MyAnimeList"],
    };
  }

  function mergeAnimeSources(aniListItems, jikanItems) {
    const merged = new Map();
    for (const raw of aniListItems) {
      const item = animeFromAniList(raw);
      merged.set(item.key, item);
    }
    for (const raw of jikanItems) {
      const item = animeFromJikan(raw);
      const current = merged.get(item.key);
      if (!current) {
        merged.set(item.key, item);
        continue;
      }
      merged.set(item.key, {
        ...item,
        ...current,
        title: current.title || item.title,
        originalTitle: current.originalTitle || item.originalTitle,
        image: current.image || item.image,
        genres: [...new Set([...current.genres, ...item.genres])],
        ratings: [...current.ratings, ...item.ratings],
        popularity: Math.max(current.popularity, item.popularity),
        favourites: Math.max(current.favourites, item.favourites),
        links: [...current.links, ...item.links],
        sources: [...new Set([...current.sources, ...item.sources])],
      });
    }
    return [...merged.values()].map((item) => ({
      ...item,
      pickScore: confidenceAdjustedScore(item.ratings),
    })).sort((left, right) => (right.pickScore || 0) - (left.pickScore || 0));
  }

  function normaliseTvMazeSchedule(episodes) {
    const shows = new Map();
    for (const episode of episodes) {
      const show = episode.show || episode._embedded?.show;
      if (!show) continue;
      const current = shows.get(show.id);
      if (current && current.nextDate <= episode.airdate) continue;
      const score = Number.isFinite(show.rating?.average) ? show.rating.average * 10 : null;
      const ratings = score === null ? [] : [{ source: "TVmaze", score, count: show.weight || 0 }];
      shows.set(show.id, {
        key: `tvmaze:${show.id}`,
        title: show.name,
        originalTitle: null,
        image: show.image?.original || show.image?.medium || null,
        year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
        season: null,
        format: show.type || "TV",
        episodes: null,
        genres: show.genres || [],
        status: show.status || null,
        nextDate: episode.airdate || null,
        nextEpisode: episode.number || null,
        nextEpisodeName: episode.name || null,
        network: show.network?.name || show.webChannel?.name || null,
        ratings,
        popularity: show.weight || 0,
        favourites: 0,
        links: [{ source: "TVmaze", url: show.url }].filter((link) => link.url),
        sources: ["TVmaze"],
        pickScore: confidenceAdjustedScore(ratings),
      });
    }
    return [...shows.values()].sort((left, right) => (right.pickScore || 0) - (left.pickScore || 0));
  }

  function normaliseTmdbMovies(items) {
    return items.map((item) => {
      const ratings = Number.isFinite(item.vote_average) && item.vote_average > 0
        ? [{ source: "TMDB", score: Number((item.vote_average * 10).toFixed(1)), count: item.vote_count || 0 }]
        : [];
      return {
        key: `tmdb:${item.id}`,
        title: item.title || item.original_title || "Untitled",
        originalTitle: item.original_title || null,
        image: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : null,
        year: item.release_date ? Number(item.release_date.slice(0, 4)) : null,
        season: null,
        format: "Movie",
        episodes: null,
        genres: [],
        status: null,
        nextDate: item.release_date || null,
        nextEpisode: null,
        ratings,
        popularity: item.popularity || 0,
        favourites: 0,
        links: [{ source: "TMDB", url: `https://www.themoviedb.org/movie/${item.id}` }],
        sources: ["TMDB"],
        pickScore: confidenceAdjustedScore(ratings),
      };
    }).sort((left, right) => (right.pickScore || 0) - (left.pickScore || 0));
  }

  async function checkedJson(response, source) {
    if (!response.ok) {
      const retry = response.headers.get("Retry-After");
      throw new Error(`${source} returned ${response.status}${retry ? ` · retry in ${retry}s` : ""}`);
    }
    return response.json();
  }

  async function fetchAniListSeason({ year, season, page = 1, perPage = 30, fetchImpl = root.fetch }) {
    const query = `query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, season: $season, seasonYear: $seasonYear, isAdult: false, sort: TRENDING_DESC) {
          id idMal title { romaji english native } coverImage { large extraLarge color }
          siteUrl averageScore popularity favourites episodes format genres seasonYear season status
          nextAiringEpisode { airingAt episode }
        }
      }
    }`;
    const response = await fetchImpl(ANI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { season, seasonYear: year, page, perPage } }),
    });
    const payload = await checkedJson(response, "AniList");
    if (payload.errors?.length) throw new Error(payload.errors[0].message || "AniList query failed");
    return payload.data?.Page?.media || [];
  }

  async function fetchJikanSeason({ year, season, fetchImpl = root.fetch }) {
    const url = `${JIKAN_URL}/seasons/${year}/${season.toLowerCase()}`;
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    const items = (await checkedJson(response, "Jikan/MyAnimeList")).data || [];
    return items.filter((item) => (
      !String(item.rating || "").startsWith("Rx")
      && !(item.explicit_genres || []).some((genre) => genre.name === "Hentai")
    ));
  }

  async function fetchTvMazeDay({ date, country = "GB", fetchImpl = root.fetch }) {
    const [broadcast, streaming] = await Promise.all([
      fetchImpl(`${TVMAZE_URL}/schedule?country=${encodeURIComponent(country)}&date=${date}`),
      fetchImpl(`${TVMAZE_URL}/schedule/web?country=&date=${date}`),
    ]);
    const [broadcastItems, streamingItems] = await Promise.all([
      checkedJson(broadcast, "TVmaze broadcast schedule"),
      checkedJson(streaming, "TVmaze streaming schedule"),
    ]);
    return [...broadcastItems, ...streamingItems];
  }

  async function fetchTmdbMovies({ token, startDate, endDate, page = 1, fetchImpl = root.fetch }) {
    if (!token) throw new Error("Connect a TMDB read token to load live movies.");
    const params = new URLSearchParams({
      language: "en-GB",
      include_adult: "false",
      include_video: "false",
      page: String(page),
      sort_by: "popularity.desc",
      "primary_release_date.gte": startDate,
      "primary_release_date.lte": endDate,
      "vote_count.gte": "20",
    });
    const response = await fetchImpl(`${TMDB_URL}/discover/movie?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    return (await checkedJson(response, "TMDB")).results || [];
  }

  const api = {
    balanceMediaKinds,
    confidenceAdjustedScore,
    fetchAniListSeason,
    fetchJikanSeason,
    fetchTmdbMovies,
    fetchTvMazeDay,
    mergeAnimeSources,
    normaliseTmdbMovies,
    normaliseTvMazeSchedule,
    seasonDateRange,
    seasonForDate,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.WatchLabDiscovery = api;
})(typeof globalThis === "undefined" ? this : globalThis);
