const test = require("node:test");
const assert = require("node:assert/strict");

const {
  balanceMediaKinds,
  confidenceAdjustedScore,
  fetchAniListSeason,
  fetchJikanSeason,
  fetchTmdbMovies,
  fetchTvMazeDay,
  mergeAnimeSources,
  normaliseTvMazeSchedule,
  seasonForDate,
} = require("./discovery.js");

test("all-media discovery interleaves media lanes instead of letting one source dominate", () => {
  const items = [
    { key: "a1", kind: "anime" },
    { key: "a2", kind: "anime" },
    { key: "t1", kind: "tv" },
    { key: "m1", kind: "movie" },
  ];

  assert.deepEqual(balanceMediaKinds(items).map((item) => item.key), ["a1", "t1", "m1", "a2"]);
});

test("calendar dates map to named anime seasons", () => {
  assert.deepEqual(seasonForDate(new Date("2026-01-10T12:00:00Z")), { year: 2026, season: "WINTER" });
  assert.deepEqual(seasonForDate(new Date("2026-04-10T12:00:00Z")), { year: 2026, season: "SPRING" });
  assert.deepEqual(seasonForDate(new Date("2026-08-13T12:00:00Z")), { year: 2026, season: "SUMMER" });
  assert.deepEqual(seasonForDate(new Date("2026-11-10T12:00:00Z")), { year: 2026, season: "FALL" });
});

test("AniList and MyAnimeList entries merge by MAL identifier without hiding source scores", () => {
  const merged = mergeAnimeSources(
    [{
      id: 1,
      idMal: 52991,
      title: { english: "Frieren", romaji: "Sousou no Frieren" },
      coverImage: { extraLarge: "https://img.example/anilist.jpg", color: "#abc" },
      siteUrl: "https://anilist.co/anime/1",
      averageScore: 91,
      popularity: 500000,
      favourites: 45000,
      episodes: 28,
      format: "TV",
      genres: ["Adventure", "Fantasy"],
      seasonYear: 2023,
      season: "FALL",
      status: "FINISHED",
      nextAiringEpisode: null,
    }],
    [{
      mal_id: 52991,
      title_english: "Frieren",
      title: "Sousou no Frieren",
      url: "https://myanimelist.net/anime/52991",
      images: { jpg: { large_image_url: "https://img.example/mal.jpg" } },
      score: 9.29,
      scored_by: 700000,
      members: 1200000,
      episodes: 28,
      type: "TV",
      genres: [{ name: "Adventure" }, { name: "Fantasy" }],
      year: 2023,
      season: "fall",
      status: "Finished Airing",
    }],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].key, "mal:52991");
  assert.equal(merged[0].title, "Frieren");
  assert.deepEqual(merged[0].ratings, [
    { source: "AniList", score: 91, count: 500000 },
    { source: "MyAnimeList", score: 92.9, count: 700000 },
  ]);
  assert.equal(merged[0].pickScore, 92);
});

test("confidence score shrinks tiny samples toward a transparent neutral prior", () => {
  assert.equal(confidenceAdjustedScore([{ score: 90, count: 0 }]), 65);
  assert.ok(confidenceAdjustedScore([{ score: 90, count: 100000 }]) > 89);
});

test("TVmaze schedule normalisation deduplicates shows and keeps the next episode", () => {
  const show = {
    id: 42,
    name: "Signal House",
    url: "https://www.tvmaze.com/shows/42/signal-house",
    rating: { average: 8.4 },
    weight: 88,
    genres: ["Drama", "Mystery"],
    premiered: "2026-08-01",
    image: { original: "https://img.example/show.jpg" },
    network: { name: "BBC Two" },
    webChannel: null,
  };
  const results = normaliseTvMazeSchedule([
    { id: 101, name: "First", airdate: "2026-08-13", season: 1, number: 1, show },
    { id: 102, name: "Second", airdate: "2026-08-20", season: 1, number: 2, show },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Signal House");
  assert.equal(results[0].nextDate, "2026-08-13");
  assert.deepEqual(results[0].ratings, [{ source: "TVmaze", score: 84, count: 88 }]);
});

test("live provider requests use the selected season and date", async () => {
  const requests = [];
  const fakeFetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("anilist")) return new Response(JSON.stringify({ data: { Page: { media: [] } } }));
    if (String(url).includes("tvmaze")) return new Response(JSON.stringify([]));
    return new Response(JSON.stringify({ data: [] }));
  };

  await fetchAniListSeason({ year: 2026, season: "SUMMER", fetchImpl: fakeFetch });
  await fetchJikanSeason({ year: 2026, season: "SUMMER", fetchImpl: fakeFetch });
  await fetchTvMazeDay({ date: "2026-08-13", fetchImpl: fakeFetch });

  const aniBody = JSON.parse(requests[0].options.body);
  assert.deepEqual(aniBody.variables, { season: "SUMMER", seasonYear: 2026, page: 1, perPage: 30 });
  assert.match(requests[1].url, /\/v4\/seasons\/2026\/summer/);
  assert.match(requests[2].url, /schedule\?country=GB&date=2026-08-13/);
  assert.match(requests[3].url, /schedule\/web\?country=&date=2026-08-13/);
});

test("TMDB movie discovery keeps credentials in the authorization header", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ results: [] }));
  };

  await fetchTmdbMovies({
    token: "read-token",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    fetchImpl: fakeFetch,
  });

  assert.match(request.url, /discover\/movie/);
  assert.match(request.url, /primary_release_date\.gte=2026-07-01/);
  assert.equal(request.options.headers.Authorization, "Bearer read-token");
  assert.equal(request.url.includes("read-token"), false);
});

test("Jikan seasonal discovery excludes explicitly adult entries client-side", async () => {
  let requestedUrl;
  const fakeFetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      data: [
        { mal_id: 1, title: "Safe", rating: "PG-13 - Teens 13 or older", explicit_genres: [] },
        { mal_id: 2, title: "Explicit", rating: "Rx - Hentai", explicit_genres: [{ name: "Hentai" }] },
      ],
    }));
  };

  const items = await fetchJikanSeason({ year: 2026, season: "SUMMER", fetchImpl: fakeFetch });

  assert.equal(requestedUrl, "https://api.jikan.moe/v4/seasons/2026/summer");
  assert.deepEqual(items.map((item) => item.mal_id), [1]);
});
