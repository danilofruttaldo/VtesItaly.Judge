/* VTES Italy Judge — Vademecum sanzioni.
 * Loads the prebuilt vademecum.json and renders a searchable, filterable list
 * grouped by category. Optimized for phone consultation: single column,
 * sticky search/filter chips, expandable cards via native <details>.
 */
import {
  SANCTION_ORDER,
  SANCTION_LABELS,
  SANCTION_VARS,
  escapeHtml,
  computeFiltered,
  groupByCategory,
  parseReference,
  parseSanction,
} from "./core.mjs";

const FILTER_LABELS = {
  ...SANCTION_LABELS,
  TBD: "TBD",
};

const FILTER_VARS = {
  ...SANCTION_VARS,
  TBD: "--s-other",
};

const state = {
  items: [],
  query: "",
  enabled: new Set(), // empty = no filter
};

const el = {
  q: document.getElementById("q"),
  filters: document.getElementById("sanction-filters"),
  list: document.getElementById("list"),
  empty: document.getElementById("empty"),
  loading: document.getElementById("loading"),
  count: document.getElementById("count"),
  reset: document.getElementById("reset"),
};

function renderReference(ref) {
  const parsed = parseReference(ref);
  if (parsed.length === 0) return "";
  const links = parsed.map((p) => {
    const label = `Rif. ${p.number}`;
    if (!p.url) return `<span class="item-ref">${escapeHtml(label)}</span>`;
    return `<a class="item-ref" href="${escapeHtml(p.url)}" rel="noopener" target="_blank" title="${escapeHtml(p.title)}">${escapeHtml(label)}</a>`;
  });
  return links.join("");
}

/* Renders the sanction badge(s) inside the item summary. Multi-sanction
 * entries enumerate each sanction as a separate pill so the user sees the
 * full range at a glance. Placeholders render as a neutral pill with the
 * fallback description (e.g. "Da definire") so empty cells aren't blank. */
function renderSanctionBadge(parsed) {
  if (parsed.kind === "placeholder") {
    return `<span class="badge badge-tbd">${escapeHtml(parsed.description)}</span>`;
  }
  return parsed.sanctions
    .map((s) => `<span class="badge" data-sanction="${escapeHtml(s)}">${escapeHtml(SANCTION_LABELS[s] || s)}</span>`)
    .join("");
}

/* Builds the inline style for an item's left-edge color strip. Multi-sanction
 * items get a vertical gradient blending the two endpoint colors; single
 * sanctions get a solid color; placeholders use the neutral "other" color. */
function itemEdgeStyle(parsed) {
  if (parsed.kind === "single") {
    return `--edge: var(${SANCTION_VARS[parsed.sanctions[0]]})`;
  }
  if (parsed.kind === "multi") {
    const first = SANCTION_VARS[parsed.sanctions[0]];
    const last = SANCTION_VARS[parsed.sanctions[parsed.sanctions.length - 1]];
    return `--edge: linear-gradient(to bottom, var(${first}), var(${last}))`;
  }
  return `--edge: var(--s-other)`;
}

function renderFilterChips() {
  const order = [...SANCTION_ORDER, "TBD"];
  el.filters.innerHTML = order
    .map((s) => {
      const label = FILTER_LABELS[s];
      const cssVar = FILTER_VARS[s];
      return `<button class="chip" type="button" data-sanction="${escapeHtml(s)}" aria-pressed="false" style="--chip-color: var(${cssVar})"><span class="chip-dot" aria-hidden="true"></span>${escapeHtml(label)}</button>`;
    })
    .join("");
}

function render() {
  const filtered = computeFiltered(state.items, state.query, state.enabled);
  const total = state.items.length;
  el.count.textContent = filtered.length === total ? `${total} voci` : `${filtered.length} / ${total}`;
  el.reset.hidden = state.query === "" && state.enabled.size === 0;

  if (filtered.length === 0) {
    el.list.innerHTML = "";
    el.empty.hidden = false;
    return;
  }
  el.empty.hidden = true;

  const groups = groupByCategory(filtered);
  const filtersActive = state.query !== "" || state.enabled.size > 0;
  const html = [];
  for (const [category, items] of groups) {
    const open = filtersActive ? " open" : "";
    html.push(`<details class="category"${open}>`);
    html.push(
      `<summary class="category-summary"><span class="category-title">${escapeHtml(category)}</span><span class="category-count">${items.length}</span></summary>`,
    );
    html.push(`<div class="category-body">`);
    for (const it of items) {
      const parsed = parseSanction(it.sanction);
      const ref = renderReference(it.reference);
      const itemOpen = filtersActive && state.query !== "" ? " open" : "";
      const klass = `item${parsed.kind === "multi" ? " item-multi" : ""}${parsed.kind === "placeholder" ? " item-tbd" : ""}`;
      html.push(`<details class="${klass}" style="${itemEdgeStyle(parsed)}"${itemOpen}>`);
      html.push(`<summary class="item-summary">`);
      html.push(`<span class="item-title">${escapeHtml(it.infraction)}</span>`);
      html.push(`<span class="item-badges">${renderSanctionBadge(parsed)}</span>`);
      html.push(`</summary>`);
      html.push(`<div class="item-body">`);
      if (ref) html.push(`<div class="item-refs">${ref}</div>`);
      if (it.notes) html.push(`<div class="item-notes">${escapeHtml(it.notes)}</div>`);
      if (!ref && !it.notes) html.push(`<div class="item-notes muted">Nessun dettaglio aggiuntivo.</div>`);
      html.push(`</div>`);
      html.push(`</details>`);
    }
    html.push(`</div>`);
    html.push(`</details>`);
  }
  el.list.innerHTML = html.join("");
}

function bindEvents() {
  el.q.addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });

  el.filters.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const s = chip.dataset.sanction;
    if (state.enabled.has(s)) {
      state.enabled.delete(s);
      chip.setAttribute("aria-pressed", "false");
    } else {
      state.enabled.add(s);
      chip.setAttribute("aria-pressed", "true");
    }
    render();
  });

  el.reset.addEventListener("click", () => {
    state.query = "";
    state.enabled.clear();
    el.q.value = "";
    el.filters.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
    render();
  });
}

async function init() {
  renderFilterChips();
  bindEvents();
  try {
    const resp = await fetch("./data/vademecum.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    state.items = Array.isArray(data) ? data : data.items || [];
    el.loading.hidden = true;
    render();
  } catch (err) {
    console.error("vademecum load failed:", err);
    el.loading.textContent = "Errore nel caricamento del vademecum.";
  }
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}
