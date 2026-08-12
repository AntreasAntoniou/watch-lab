const test = require("node:test");
const assert = require("node:assert/strict");

const { queryRows } = require("./mock-api.js");

const rows = [
  { imdb_id: "demo-001", primary_title: "Lantern Light", original_title: "Lantern Light", start_year: 2021, num_votes: 4000 },
  { imdb_id: "demo-002", primary_title: "Moonlight Map", original_title: "Moonlight Map", start_year: 2024, num_votes: 3000 },
  { imdb_id: "demo-003", primary_title: "Dark Map", original_title: "Dark Map", start_year: 2025, num_votes: 900 },
];

test("static demo combines search, typed filters, sorting, and pagination", () => {
  const result = queryRows(rows, {
    search: "light",
    filters: [{ field: "num_votes", operator: "gte", value: 1000 }],
    sorts: [{ field: "start_year", direction: "desc" }],
    page: 1,
    page_size: 1,
  });

  assert.equal(result.total, 2);
  assert.equal(result.pages, 2);
  assert.deepEqual(result.rows.map((row) => row.primary_title), ["Moonlight Map"]);
});

test("static demo supports null, between, and boolean filters", () => {
  const fixture = [
    { imdb_id: "demo-001", start_year: 2020, end_year: null, is_adult: false },
    { imdb_id: "demo-002", start_year: 2024, end_year: 2025, is_adult: true },
  ];
  const result = queryRows(fixture, {
    filters: [
      { field: "end_year", operator: "is_null" },
      { field: "start_year", operator: "between", value: [2019, 2021] },
      { field: "is_adult", operator: "eq", value: false },
    ],
    page: 1,
    page_size: 25,
  });

  assert.deepEqual(result.rows.map((row) => row.imdb_id), ["demo-001"]);
});
