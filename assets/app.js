/* VTES Italy Judge — Vademecum sanzioni.
 * Loads the prebuilt vademecum.json and renders a searchable, filterable list
 * grouped by TIPOLOGIA. Optimized for phone consultation: single column,
 * sticky search/filter, expandable cards.
 */
import { SANCTION_ORDER, escapeHtml, computeFiltered, groupByCategory, parseReference } from "./core.mjs";

const FILTER_LABELS = {
  CAUTION: "Caution",
  WARNING: "Warning",
  "GAME LOSS": "Game loss",
  DISQUALIFICATION: "DQ",
  "DISQUALIFICATION WITHOUT PRIZE": "DQ no prize",
  OTHER: "Altro",
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

/* Renders the reference cell as one or more anchors to the Judges' Guide.
 * Falls back to plain text when the number isn't in our known-rules map, so
 * the user still sees the reference but doesn't click into a broken link. */
function renderReference(ref) {
  const parsed = parseReference(ref);
  if (parsed.length === 0) return "";
  const links = parsed.map((p) => {
    const label = `Rif. ${p.number}`;
    if (!p.url) return `<span class="item-ref">${escapeHtml(label)}</span>`;
    return `<a class="item-ref" href="${escapeHtml(p.url)}" rel="noopener" target="_blank" title="${escapeHtml(p.title)}">${escapeHtml(label)}</a>`;
  });
  return links.join(" · ");
}

function renderFilterChips() {
  const order = [...SANCTION_ORDER, "OTHER"];
  el.filters.innerHTML = order
    .map(
      (s) =>
        `<button class="chip" type="button" data-sanction="${escapeHtml(s)}" aria-pressed="false">${escapeHtml(FILTER_LABELS[s])}</button>`,
    )
    .join("");
}

function render() {
  const filtered = computeFiltered(state.items, state.query, state.enabled);
  const total = state.items.length;
  el.count.textContent = filtered.length === total ? `${total} sanzioni` : `${filtered.length} / ${total}`;
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
    // Auto-open categories when a filter is active so users see results
    // without an extra tap. Closed by default in the unfiltered view to keep
    // the phone screen short.
    const open = filtersActive ? " open" : "";
    html.push(`<details class="category"${open}>`);
    html.push(
      `<summary class="category-summary"><span class="category-title">${escapeHtml(category)}</span><span class="category-count">${items.length}</span></summary>`,
    );
    html.push(`<div class="category-body">`);
    for (const it of items) {
      const sanction = it.sanction || "";
      const ref = renderReference(it.reference);
      const itemOpen = filtersActive && state.query !== "" ? " open" : "";
      html.push(`<details class="item" data-sanction="${escapeHtml(sanction)}"${itemOpen}>`);
      html.push(`<summary class="item-summary">`);
      html.push(`<span class="item-title">${escapeHtml(it.infraction)}</span>`);
      html.push(`<span class="badge" data-sanction="${escapeHtml(sanction)}">${escapeHtml(sanction || "—")}</span>`);
      html.push(`</summary>`);
      html.push(`<div class="item-body">`);
      if (ref) html.push(`<div class="item-meta">${ref}</div>`);
      if (it.notes) html.push(`<div class="item-notes">${escapeHtml(it.notes)}</div>`);
      if (!ref && !it.notes) html.push(`<div class="item-meta">Nessun dettaglio.</div>`);
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

  // <details>/<summary> handle expand/collapse natively — no JS toggling.
}

async function init() {
  renderFilterChips();
  bindEvents();
  try {
    const resp = await fetch("./data/vademecum.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    state.items = data.items || [];
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
