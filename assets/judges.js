/* Bootstraps the /judges page: fetches data/judges.json (network-first via
 * the service worker, falls back to the SW cache when offline) and renders
 * the table. Kept intentionally tiny — no dependency on app.js or core.mjs.
 */
// @ts-check

/** @typedef {{ name: string, vekn_id: string, rank: string, valid_from: string, valid_to: string }} Judge */
/** @typedef {"name" | "rank" | "vekn_id" | "valid_to"} SortKey */
/** @typedef {"asc" | "desc"} SortDir */

const RANK_LABEL = /** @type {Record<string, string>} */ ({
  "Elder Judge": "Elder",
  "Ancilla Judge": "Ancilla",
  "Neonate Judge": "Neonate",
});

/* Severity-ordered rank tiers so "sort by rank ascending" reads as
 * "most senior first". Anything not in this set lands at the bottom. */
const RANK_TIER = /** @type {Record<string, number>} */ ({
  "Elder Judge": 0,
  "Ancilla Judge": 1,
  "Neonate Judge": 2,
});

const NAME_COLLATOR = new Intl.Collator("it-IT", { sensitivity: "base" });

/** @param {string} iso */
function formatDate(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** @param {string} rank */
function rankSlug(rank) {
  return rank
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** @param {string} iso */
function isExpired(iso) {
  // Compare against UTC midnight today; we don't need timezone precision
  // for "is the certification still valid" — a one-day window in either
  // direction is fine, the page is informational not authoritative.
  const today = new Date().toISOString().slice(0, 10);
  return iso < today;
}

/**
 * Stable comparator for two judges by the active sort key and direction.
 * Each column has a natural primary order; the tiebreaker is always
 * name (it-IT collation) so a "Rank asc" view still reads predictably
 * within a tier.
 * @param {Judge} a
 * @param {Judge} b
 * @param {SortKey} key
 * @param {SortDir} dir
 */
function compareJudges(a, b, key, dir) {
  const sign = dir === "asc" ? 1 : -1;
  /** @type {number} */
  let primary;
  switch (key) {
    case "name":
      primary = NAME_COLLATOR.compare(a.name, b.name);
      break;
    case "rank": {
      const ta = RANK_TIER[a.rank] ?? Number.POSITIVE_INFINITY;
      const tb = RANK_TIER[b.rank] ?? Number.POSITIVE_INFINITY;
      primary = ta - tb;
      break;
    }
    case "vekn_id":
      primary = Number(a.vekn_id) - Number(b.vekn_id);
      break;
    case "valid_to":
      primary = a.valid_to < b.valid_to ? -1 : a.valid_to > b.valid_to ? 1 : 0;
      break;
    default:
      primary = 0;
  }
  if (primary !== 0) return sign * primary;
  // Tiebreaker is always the canonical "rank tier, then name" order
  // regardless of sort direction, so ties don't shuffle on toggle.
  const tieRank = (RANK_TIER[a.rank] ?? 99) - (RANK_TIER[b.rank] ?? 99);
  return tieRank !== 0 ? tieRank : NAME_COLLATOR.compare(a.name, b.name);
}

/**
 * Render the tbody with the current judges in the current sort order.
 * Replaces the previous body wholesale — the dataset is tiny (single
 * digits), so reconciling rows in place would be premature optimisation.
 * @param {Judge[]} judges
 * @param {HTMLElement} tbody
 */
function renderRows(judges, tbody) {
  tbody.replaceChildren();
  const frag = document.createDocumentFragment();
  for (const j of judges) {
    const tr = document.createElement("tr");
    tr.dataset.rank = rankSlug(j.rank);
    if (isExpired(j.valid_to)) tr.dataset.expired = "true";

    const name = document.createElement("td");
    name.className = "j-name";
    name.textContent = j.name;
    tr.appendChild(name);

    const rank = document.createElement("td");
    rank.className = "j-rank";
    const badge = document.createElement("span");
    badge.className = "j-rank-badge";
    badge.dataset.rank = rankSlug(j.rank);
    badge.textContent = RANK_LABEL[j.rank] || j.rank;
    rank.appendChild(badge);
    tr.appendChild(rank);

    const id = document.createElement("td");
    id.className = "j-id";
    id.textContent = j.vekn_id;
    tr.appendChild(id);

    const exp = document.createElement("td");
    exp.className = "j-exp";
    exp.textContent = formatDate(j.valid_to);
    if (isExpired(j.valid_to)) {
      const tag = document.createElement("span");
      tag.className = "j-exp-tag";
      tag.textContent = "scaduto";
      exp.appendChild(tag);
    }
    tr.appendChild(exp);

    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

/**
 * Wire the sort buttons in the table head: clicking a column header
 * sorts by that key (toggling direction if it's already active), updates
 * `aria-sort` on every <th>, and re-renders the body. The initial
 * `aria-sort="ascending"` on the Rank column establishes the default
 * state for both the UI indicator and the first click toggle.
 * @param {Judge[]} judges
 * @param {HTMLTableElement} table
 * @param {HTMLElement} tbody
 */
function wireSorting(judges, table, tbody) {
  const buttons = table.querySelectorAll("button.sort-btn");
  /** @type {SortKey} */
  let currentKey = "name";
  /** @type {SortDir} */
  let currentDir = "asc";

  const apply = () => {
    const sorted = [...judges].sort((a, b) => compareJudges(a, b, currentKey, currentDir));
    renderRows(sorted, tbody);
    for (const btn of buttons) {
      const th = /** @type {HTMLTableCellElement} */ (btn.parentElement);
      const key = btn.getAttribute("data-sort");
      if (key === currentKey) {
        th.setAttribute("aria-sort", currentDir === "asc" ? "ascending" : "descending");
      } else {
        th.setAttribute("aria-sort", "none");
      }
    }
  };

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      const key = /** @type {SortKey | null} */ (btn.getAttribute("data-sort"));
      if (!key) return;
      if (key === currentKey) {
        currentDir = currentDir === "asc" ? "desc" : "asc";
      } else {
        currentKey = key;
        currentDir = "asc";
      }
      apply();
    });
  }

  apply();
}

function ready() {
  const loading = document.getElementById("judges-loading");
  const empty = document.getElementById("judges-empty");
  const table = /** @type {HTMLTableElement | null} */ (document.getElementById("judges-table"));
  const tbody = document.getElementById("judges-tbody");
  const meta = document.getElementById("judges-meta");
  if (!loading || !empty || !table || !tbody || !meta) return;

  fetch("./data/judges.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((/** @type {{ generated_at: string, judges: Judge[] }} */ payload) => {
      loading.hidden = true;
      const judges = Array.isArray(payload.judges) ? payload.judges : [];
      if (judges.length === 0) {
        empty.hidden = false;
        return;
      }

      table.hidden = false;
      wireSorting(judges, table, tbody);

      if (payload.generated_at) {
        const d = new Date(payload.generated_at);
        if (!Number.isNaN(d.getTime())) {
          meta.textContent = ` Aggiornato il ${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}.`;
        }
      }
    })
    .catch((err) => {
      loading.textContent = "Impossibile caricare la lista. Riprova più tardi.";
      loading.classList.add("is-error");
      console.error("judges: load failed", err);
    });

  // Register the SW so /judges works offline once visited online, same
  // as the vademecum page. Failures are not fatal — the page already
  // works without a SW, the offline-cache is just a nice-to-have.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ready, { once: true });
} else {
  ready();
}
