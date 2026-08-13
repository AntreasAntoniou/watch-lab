(function exposeMockApi(root) {
  const fields = [
    { key: "imdb_id", label: "IMDb ID", kind: "text", nullable: false },
    { key: "primary_title", label: "Primary title", kind: "text", nullable: false },
    { key: "original_title", label: "Original title", kind: "text", nullable: true },
    { key: "title_type", label: "Title type", kind: "text", nullable: true },
    { key: "start_year", label: "Start year", kind: "number", nullable: true },
    { key: "end_year", label: "End year", kind: "number", nullable: true },
    { key: "runtime_minutes", label: "Runtime (min)", kind: "number", nullable: true },
    { key: "genres", label: "Genres", kind: "text", nullable: true },
    { key: "average_rating", label: "IMDb rating", kind: "number", nullable: false },
    { key: "num_votes", label: "Votes", kind: "number", nullable: false },
    { key: "is_adult", label: "Adult title", kind: "boolean", nullable: true },
  ];

  const titles = [
    "Lanterns at Low Tide", "The Ninth Observatory", "Salt Archive", "Quiet Engines",
    "Orchard of Satellites", "A Map of Ash", "Blue Hour Dispatch", "The Glass Cartographer",
    "Three Winters North", "Signal Garden", "After the Last Tram", "Moths in the Projector",
    "Borrowed Constellations", "The Copper Season", "Museum of Small Weather",
    "Nocturne for Machines", "Paper Kingdom Radio", "The Long Way Through Noon",
    "Stone Fruit Detective", "Wind Index", "Night Ferry Almanac", "Axiom House", "Dust Choir",
    "The Weather Between Us",
  ];
  const titleTypes = ["movie", "tvSeries", "short", "movie", "tvMiniSeries", "videoGame"];
  const genres = ["Drama,Mystery", "Adventure,Sci-Fi", "Documentary", "Comedy,Drama", "Fantasy"];
  const demoRows = titles.map((title, index) => ({
    imdb_id: `demo-${String(index + 1).padStart(3, "0")}`,
    primary_title: title,
    original_title: title,
    title_type: titleTypes[index % titleTypes.length],
    start_year: index === 0 ? 1874 : 2002 + index,
    end_year: index !== 0 && index % 7 === 0 ? 2003 + index : null,
    runtime_minutes: index % 5 === 0 ? null : 72 + ((index * 7) % 61),
    genres: genres[index % genres.length],
    average_rating: Number((6.4 + ((index * 7) % 25) / 10).toFixed(1)),
    num_votes: 412 + ((index * 7919) % 28700),
    is_adult: false,
  }));

  function normalized(value) {
    return String(value ?? "").toLowerCase();
  }

  function matchesFilter(row, filter) {
    const value = row[filter.field];
    const wanted = filter.value;
    if (filter.operator === "is_null") return value === null || value === undefined;
    if (filter.operator === "not_null") return value !== null && value !== undefined;
    if (filter.operator === "contains") return normalized(value).includes(normalized(wanted));
    if (filter.operator === "not_contains") return !normalized(value).includes(normalized(wanted));
    if (filter.operator === "starts_with") return normalized(value).startsWith(normalized(wanted));
    if (filter.operator === "in") {
      const choices = String(wanted).split(",").map((item) => normalized(item.trim())).filter(Boolean);
      return choices.includes(normalized(value));
    }
    if (filter.operator === "between") return value >= wanted[0] && value <= wanted[1];
    if (filter.operator === "eq") {
      return typeof value === "string" ? normalized(value) === normalized(wanted) : value === wanted;
    }
    if (filter.operator === "neq") {
      return typeof value === "string" ? normalized(value) !== normalized(wanted) : value !== wanted;
    }
    if (filter.operator === "gt") return value > wanted;
    if (filter.operator === "gte") return value >= wanted;
    if (filter.operator === "lt") return value < wanted;
    if (filter.operator === "lte") return value <= wanted;
    throw new Error(`Unsupported operator: ${filter.operator}`);
  }

  function compareValues(left, right, direction) {
    if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
    if (right === null || right === undefined) return -1;
    const order = typeof left === "string"
      ? left.localeCompare(right, undefined, { sensitivity: "base" })
      : Number(left) - Number(right);
    return direction === "asc" ? order : -order;
  }

  function queryRows(rows, request = {}) {
    const started = typeof performance === "undefined" ? Date.now() : performance.now();
    const search = normalized(request.search).trim();
    let result = rows.filter((row) => !search || [row.primary_title, row.original_title, row.imdb_id]
      .some((value) => normalized(value).includes(search)));
    result = result.filter((row) => (request.filters || []).every((item) => matchesFilter(row, item)));

    const sorts = (request.sorts || []).slice(0, 5);
    if (!sorts.length) sorts.push({ field: "num_votes", direction: "desc" });
    result.sort((left, right) => {
      for (const sort of sorts) {
        const order = compareValues(left[sort.field], right[sort.field], sort.direction || "desc");
        if (order !== 0) return order;
      }
      return normalized(left.imdb_id).localeCompare(normalized(right.imdb_id));
    });

    const page = Math.max(1, Number(request.page || 1));
    const pageSize = Math.max(1, Number(request.page_size || 50));
    const total = result.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const elapsed = (typeof performance === "undefined" ? Date.now() : performance.now()) - started;
    return {
      rows: result.slice((page - 1) * pageSize, page * pageSize),
      total, page, page_size: pageSize, pages, elapsed_ms: Number(elapsed.toFixed(1)),
    };
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function installMockFetch() {
    const originalFetch = root.fetch.bind(root);
    root.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === "string" ? input : input.url, root.location.href);
      if (url.pathname === "/api/schema") return jsonResponse({ fields });
      if (url.pathname === "/api/about") {
        return jsonResponse({
          data_mode: "synthetic_demo",
          is_demo: true,
          notice: "This public instance contains fictional demonstration records only.",
        });
      }
      if (url.pathname === "/api/stats") {
        const years = demoRows.map((row) => row.start_year);
        return jsonResponse({
          rated_titles: demoRows.length,
          total_votes: demoRows.reduce((total, row) => total + row.num_votes, 0),
          earliest_year: Math.min(...years),
          latest_year: Math.max(...years),
          built_at: "2026-08-13T00:00:00Z",
        });
      }
      if (url.pathname === "/api/query") {
        try {
          return jsonResponse(queryRows(demoRows, JSON.parse(options.body || "{}")));
        } catch (error) {
          return jsonResponse({ detail: error.message }, 400);
        }
      }
      return originalFetch(input, options);
    };
  }

  const api = { demoRows, fields, installMockFetch, queryRows };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.WatchLabMockApi = api;
  if (typeof window !== "undefined") installMockFetch();
})(typeof globalThis === "undefined" ? this : globalThis);
