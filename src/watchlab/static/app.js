const state = {
  fields: [],
  filters: [],
  sorts: [{ field: "num_votes", direction: "desc" }],
  search: "",
  page: 1,
  pageSize: 50,
  pages: 1,
};

const operators = {
  text: [
    ["contains", "contains"], ["not_contains", "does not contain"],
    ["starts_with", "starts with"], ["eq", "equals"], ["neq", "does not equal"],
    ["in", "is one of (comma separated)"], ["is_null", "is empty"], ["not_null", "is not empty"],
  ],
  number: [
    ["gte", "at least"], ["lte", "at most"], ["gt", "greater than"],
    ["lt", "less than"], ["eq", "equals"], ["neq", "does not equal"],
    ["between", "between"], ["is_null", "is empty"], ["not_null", "is not empty"],
  ],
  boolean: [["eq", "is"], ["neq", "is not"]],
};

const $ = (selector) => document.querySelector(selector);
const formatNumber = (value) => new Intl.NumberFormat("en-GB").format(value ?? 0);
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function fieldByKey(key) {
  return state.fields.find((field) => field.key === key);
}

function fillFieldSelects() {
  const options = state.fields.map((field) =>
    `<option value="${field.key}">${escapeHtml(field.label)}</option>`).join("");
  $("#filterField").innerHTML = options;
  $("#sortField").innerHTML = options;
  $("#filterField").value = "average_rating";
  $("#sortField").value = "average_rating";
  updateOperators();
}

function updateOperators() {
  const field = fieldByKey($("#filterField").value);
  $("#filterOperator").innerHTML = operators[field.kind]
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  updateValueControls();
}

function updateValueControls() {
  const field = fieldByKey($("#filterField").value);
  const operator = $("#filterOperator").value;
  const input = $("#filterValue");
  const end = $("#filterValueEnd");
  const noValue = ["is_null", "not_null"].includes(operator);
  input.classList.toggle("is-hidden", noValue);
  end.classList.toggle("is-hidden", operator !== "between");
  if (field.kind === "boolean") {
    input.setAttribute("list", "booleanValues");
    input.placeholder = "true or false";
  } else {
    input.removeAttribute("list");
    input.placeholder = operator === "between" ? "From" : "Value";
  }
  input.type = field.kind === "number" ? "number" : "text";
  end.type = field.kind === "number" ? "number" : "text";
}

function addFilter() {
  const field = fieldByKey($("#filterField").value);
  const operator = $("#filterOperator").value;
  const raw = $("#filterValue").value.trim();
  const noValue = ["is_null", "not_null"].includes(operator);
  if (!noValue && !raw) {
    $("#filterValue").focus();
    return;
  }
  let value = raw;
  if (field.kind === "number") {
    value = Number(raw);
    if (!Number.isFinite(value)) { $("#filterValue").focus(); return; }
  }
  if (field.kind === "boolean") {
    if (!["true", "false"].includes(raw.toLowerCase())) { $("#filterValue").focus(); return; }
    value = raw.toLowerCase() === "true";
  }
  if (operator === "between") {
    const end = $("#filterValueEnd").value.trim();
    if (!end) { $("#filterValueEnd").focus(); return; }
    value = [Number(raw), Number(end)];
  }
  state.filters.push({ field: field.key, operator, value });
  state.page = 1;
  $("#filterValue").value = "";
  $("#filterValueEnd").value = "";
  renderRules();
  runQuery();
}

function addSort() {
  const field = $("#sortField").value;
  const direction = $("#sortDirection").value;
  state.sorts = state.sorts.filter((sort) => sort.field !== field);
  state.sorts.push({ field, direction });
  state.sorts = state.sorts.slice(-5);
  state.page = 1;
  renderRules();
  renderHead();
  runQuery();
}

function describeFilter(filter) {
  const field = fieldByKey(filter.field);
  const label = operators[field.kind].find(([key]) => key === filter.operator)?.[1] ?? filter.operator;
  const value = Array.isArray(filter.value) ? filter.value.join(" and ") : filter.value;
  return `${field.label} ${label}${["is_null", "not_null"].includes(filter.operator) ? "" : ` ${value}`}`;
}

function renderRules() {
  const filterRules = state.filters.map((filter, index) =>
    `<span class="rule-chip">${escapeHtml(describeFilter(filter))}<button data-filter="${index}" aria-label="Remove filter">×</button></span>`);
  const sortRules = state.sorts.map((sort, index) => {
    const arrow = sort.direction === "asc" ? "↑" : "↓";
    return `<span class="rule-chip sort">${index + 1}. ${escapeHtml(fieldByKey(sort.field).label)} ${arrow}<button data-sort="${index}" aria-label="Remove sort">×</button></span>`;
  });
  const rules = [...filterRules, ...sortRules];
  $("#activeRules").innerHTML = rules.length ? rules.join("") : '<span class="empty-rules">No filters or sorts</span>';
}

function renderHead() {
  $("#tableHead").innerHTML = `<tr>${state.fields.map((field) => {
    const index = state.sorts.findIndex((sort) => sort.field === field.key);
    const marker = index >= 0 ? `<span class="sort-index">${index + 1}${state.sorts[index].direction === "asc" ? "↑" : "↓"}</span>` : "";
    return `<th><button data-heading="${field.key}" title="Sort by ${escapeHtml(field.label)}">${escapeHtml(field.label)}${marker}</button></th>`;
  }).join("")}</tr>`;
}

function renderValue(field, value, row) {
  if (value === null || value === undefined) return '<span class="null">—</span>';
  if (field.key === "primary_title") {
    return `<a href="https://www.imdb.com/title/${encodeURIComponent(row.imdb_id)}/" target="_blank" rel="noreferrer" title="${escapeHtml(value)}">${escapeHtml(value)}</a>`;
  }
  if (field.key === "average_rating") return `<span class="rating">${Number(value).toFixed(1)}</span>`;
  if (field.key === "num_votes") return formatNumber(value);
  if (field.kind === "boolean") return value ? "Yes" : "No";
  return escapeHtml(value);
}

function renderRows(rows) {
  if (!rows.length) {
    $("#tableBody").innerHTML = $("#emptyRow").innerHTML;
    return;
  }
  $("#tableBody").innerHTML = rows.map((row) => `<tr>${state.fields.map((field) => {
    const classes = [
      field.key === "primary_title" ? "title-cell" : "",
      field.kind === "number" ? "number-cell" : "",
      field.key === "imdb_id" ? "code-cell" : "",
    ].filter(Boolean).join(" ");
    return `<td class="${classes}" title="${escapeHtml(row[field.key] ?? "")}">${renderValue(field, row[field.key], row)}</td>`;
  }).join("")}</tr>`).join("");
}

async function runQuery() {
  $("#loading").classList.remove("is-hidden");
  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        search: state.search, filters: state.filters, sorts: state.sorts,
        page: state.page, page_size: state.pageSize,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Query failed");
    state.pages = data.pages;
    renderRows(data.rows);
    $("#resultSummary").textContent = `${formatNumber(data.total)} matches · ${data.elapsed_ms} ms`;
    $("#pageIndicator").textContent = `Page ${formatNumber(data.page)} of ${formatNumber(data.pages)}`;
    $("#previousPage").disabled = data.page <= 1;
    $("#nextPage").disabled = data.page >= data.pages;
  } catch (error) {
    $("#tableBody").innerHTML = `<tr><td colspan="11" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
    $("#resultSummary").textContent = "The query could not run.";
  } finally {
    $("#loading").classList.add("is-hidden");
  }
}

async function initialise() {
  const [schemaResponse, statsResponse] = await Promise.all([
    fetch("/api/schema"), fetch("/api/stats"),
  ]);
  const schema = await schemaResponse.json();
  if (!statsResponse.ok) {
    const error = await statsResponse.json();
    throw new Error(error.detail || "Dataset unavailable");
  }
  const stats = await statsResponse.json();
  state.fields = schema.fields;
  fillFieldSelects();
  renderRules();
  renderHead();
  $("#titleCount").textContent = formatNumber(stats.rated_titles);
  $("#voteCount").textContent = formatNumber(stats.total_votes);
  $("#yearRange").textContent = `${stats.earliest_year ?? "—"}—${stats.latest_year ?? "—"}`;
  $("#buildState").textContent = `Index built ${new Date(stats.built_at).toLocaleDateString("en-GB")}`;
  runQuery();
}

let searchTimer;
$("#searchInput").addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = event.target.value;
    state.page = 1;
    runQuery();
  }, 250);
});
$("#pageSize").addEventListener("change", (event) => {
  state.pageSize = Number(event.target.value); state.page = 1; runQuery();
});
$("#filterField").addEventListener("change", updateOperators);
$("#filterOperator").addEventListener("change", updateValueControls);
$("#filterValue").addEventListener("keydown", (event) => { if (event.key === "Enter") addFilter(); });
$("#filterValueEnd").addEventListener("keydown", (event) => { if (event.key === "Enter") addFilter(); });
$("#addFilter").addEventListener("click", addFilter);
$("#addSort").addEventListener("click", addSort);
$("#activeRules").addEventListener("click", (event) => {
  const filterIndex = event.target.dataset.filter;
  const sortIndex = event.target.dataset.sort;
  if (filterIndex !== undefined) state.filters.splice(Number(filterIndex), 1);
  if (sortIndex !== undefined) state.sorts.splice(Number(sortIndex), 1);
  state.page = 1; renderRules(); renderHead(); runQuery();
});
$("#tableHead").addEventListener("click", (event) => {
  const field = event.target.closest("button")?.dataset.heading;
  if (!field) return;
  const current = state.sorts.find((sort) => sort.field === field);
  state.sorts = [{ field, direction: current?.direction === "desc" ? "asc" : "desc" }];
  state.page = 1; renderRules(); renderHead(); runQuery();
});
$("#clearAll").addEventListener("click", () => {
  state.filters = []; state.sorts = [{ field: "num_votes", direction: "desc" }];
  state.search = ""; state.page = 1; $("#searchInput").value = "";
  renderRules(); renderHead(); runQuery();
});
$("#previousPage").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; runQuery(); } });
$("#nextPage").addEventListener("click", () => { if (state.page < state.pages) { state.page += 1; runQuery(); } });
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement.tagName !== "INPUT") {
    event.preventDefault(); $("#searchInput").focus();
  }
});

initialise().catch((error) => {
  $("#buildState").textContent = "Index unavailable";
  $("#resultSummary").textContent = error.message;
  $("#tableBody").innerHTML = `<tr><td colspan="11" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
});
