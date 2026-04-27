/* VTES Italy Judge — Vademecum sanzioni.
 * Loads the prebuilt vademecum.json and renders a searchable, filterable list
 * grouped by category. Optimized for phone consultation: single column,
 * sticky search/filter chips, expandable cards via native <details>.
 */
import {
  SANCTION_ORDER,
  SANCTION_LABELS,
  SANCTION_SLUGS,
  escapeHtml,
  highlightHtml,
  itemSlug,
  computeFiltered,
  groupByCategory,
  parseReference,
  parseSanction,
} from "./core.mjs";

const FILTER_LABELS = {
  ...SANCTION_LABELS,
  TBD: "TBD",
};

const state = {
  items: [],
  query: "",
  enabled: new Set(), // empty = no filter
  pendingItemAnchor: null, // slug of an item to scroll/open on next render
};

const el = {
  q: document.getElementById("q"),
  filters: document.getElementById("sanction-filters"),
  list: document.getElementById("list"),
  empty: document.getElementById("empty"),
  emptyReset: document.getElementById("empty-reset"),
  loading: document.getElementById("loading"),
  count: document.getElementById("count"),
  reset: document.getElementById("reset"),
  updated: document.getElementById("updated"),
  swUpdate: document.getElementById("sw-update"),
  swUpdateBtn: document.getElementById("sw-update-btn"),
};

function renderReference(ref) {
  const parsed = parseReference(ref);
  if (parsed.length === 0) return "";
  const links = parsed.map((p) => {
    const label = `Rif. ${p.number}`;
    if (!p.url) return `<span class="item-ref">${escapeHtml(label)}</span>`;
    return `<a class="item-ref" href="${escapeHtml(p.url)}" rel="noopener noreferrer" target="_blank" title="${escapeHtml(p.title)}" aria-label="${escapeHtml(label)} — apre la VEKN Judges' Guide in una nuova scheda">${escapeHtml(label)}</a>`;
  });
  return links.join("");
}

/* Renders the sanction badge(s) inside the item summary. Multi-sanction
 * entries enumerate each sanction as a separate pill connected by an arrow
 * so the user reads it as a severity range, not two cumulative penalties.
 * Placeholders render as a neutral pill with the fallback description. */
function renderSanctionBadge(parsed) {
  if (parsed.kind === "placeholder") {
    return `<span class="badge badge-tbd">${escapeHtml(parsed.description)}</span>`;
  }
  const pills = parsed.sanctions.map(
    (s) => `<span class="badge" data-sanction="${escapeHtml(s)}">${escapeHtml(SANCTION_LABELS[s] || s)}</span>`,
  );
  if (parsed.kind === "multi") {
    return pills.join('<span class="badge-sep" aria-hidden="true">→</span>');
  }
  return pills.join("");
}

/* Builds the data-attribute string for an item's sanction color bar.
 * Single sanctions expose `data-s1`; multi-sanction items expose both
 * `data-s1` and `data-s2`; placeholders fall back to `data-s1="other"`.
 * The CSS layer maps these tokens to color variables via static attribute
 * selectors so we don't ship inline `style=`, keeping CSP strict. */
function itemEdgeAttrs(parsed) {
  if (parsed.kind === "single") {
    return `data-s1="${escapeHtml(SANCTION_SLUGS[parsed.sanctions[0]])}"`;
  }
  if (parsed.kind === "multi") {
    const first = SANCTION_SLUGS[parsed.sanctions[0]];
    const last = SANCTION_SLUGS[parsed.sanctions[parsed.sanctions.length - 1]];
    return `data-s1="${escapeHtml(first)}" data-s2="${escapeHtml(last)}"`;
  }
  return `data-s1="other"`;
}

function renderFilterChips() {
  const order = [...SANCTION_ORDER, "TBD"];
  // The chip color comes from a static CSS rule keyed on data-sanction —
  // no inline style attribute, so the page works under a strict CSP.
  el.filters.innerHTML = order
    .map((s) => {
      const label = FILTER_LABELS[s];
      return `<button class="chip" type="button" data-sanction="${escapeHtml(s)}" aria-pressed="false"><span class="chip-dot" aria-hidden="true"></span>${escapeHtml(label)}</button>`;
    })
    .join("");
}

function syncFilterChips() {
  el.filters.querySelectorAll(".chip").forEach((c) => {
    const s = c.dataset.sanction;
    c.setAttribute("aria-pressed", state.enabled.has(s) ? "true" : "false");
  });
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
  // Any filter (query OR chip) auto-expands so the result is visible without
  // an extra tap. Without this, filtering by chip would hide everything
  // behind closed accordions on mobile.
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
      const slug = itemSlug(it);
      const itemOpen = filtersActive ? " open" : "";
      const klass = `item${parsed.kind === "multi" ? " item-multi" : ""}${parsed.kind === "placeholder" ? " item-tbd" : ""}`;
      const titleHtml = highlightHtml(it.infraction, state.query);
      // Description is the situational context (examples, when it triggers).
      // Intervention is what the judge does. Either or both can be empty.
      // Fallback to legacy `notes` for unmigrated rows so an old snapshot
      // doesn't render blank during a transitional deploy.
      const descHtml = it.description ? highlightHtml(it.description, state.query) : "";
      const intHtml = it.intervention ? highlightHtml(it.intervention, state.query) : "";
      const legacyNotesHtml =
        !it.description && !it.intervention && it.notes ? highlightHtml(it.notes, state.query) : "";
      const hasBody = ref || descHtml || intHtml || legacyNotesHtml;
      html.push(`<details id="item-${escapeHtml(slug)}" class="${klass}" ${itemEdgeAttrs(parsed)}${itemOpen}>`);
      html.push(`<summary class="item-summary">`);
      html.push(`<span class="item-title">${titleHtml}</span>`);
      // The colored bar with the sanction gradient sits next to the badge
      // group so the severity range is visible at a glance, on the badge
      // itself rather than as a card-wide edge.
      html.push(`<span class="item-badges"><span class="badges-edge" aria-hidden="true"></span>`);
      html.push(`${renderSanctionBadge(parsed)}</span>`);
      html.push(`</summary>`);
      html.push(`<div class="item-body">`);
      if (descHtml) {
        html.push(
          `<section class="item-section item-section-desc"><h3 class="item-section-label">Descrizione</h3><div class="item-section-body">${descHtml}</div></section>`,
        );
      }
      if (intHtml) {
        html.push(
          `<section class="item-section item-section-int"><h3 class="item-section-label">Intervento</h3><div class="item-section-body">${intHtml}</div></section>`,
        );
      }
      if (legacyNotesHtml) {
        html.push(`<div class="item-notes">${legacyNotesHtml}</div>`);
      }
      if (!hasBody) {
        html.push(`<div class="item-notes muted">Nessun dettaglio aggiuntivo.</div>`);
      }
      // Reference + share controls live at the bottom of the card so the
      // judge reads description and intervention first, then jumps to the
      // VEKN rule or copies a link. Refs are wrapped in their own row so
      // they don't clash with the share button alignment.
      if (ref) html.push(`<div class="item-refs">${ref}</div>`);
      const shareHref = `#item=${encodeURIComponent(slug)}`;
      html.push(
        `<div class="item-actions"><a class="item-share" href="${escapeHtml(shareHref)}" aria-label="Copia link a questa voce">Link a questa voce</a></div>`,
      );
      html.push(`</div>`);
      html.push(`</details>`);
    }
    html.push(`</div>`);
    html.push(`</details>`);
  }
  el.list.innerHTML = html.join("");

  if (state.pendingItemAnchor) {
    revealItem(state.pendingItemAnchor);
    state.pendingItemAnchor = null;
  }
}

function revealItem(slug) {
  const node = document.getElementById(`item-${slug}`);
  if (!node) return;
  let p = node.parentElement;
  while (p) {
    if (p.tagName === "DETAILS") p.open = true;
    p = p.parentElement;
  }
  node.open = true;
  // Defer scrolling so the layout settles after open=true.
  requestAnimationFrame(() => {
    node.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

/* ---------- URL hash state ---------- *
 * Encodes filters into location.hash so the user can bookmark/share a
 * filtered view. Format: #q=text&s=CAUTION,GAME%20LOSS&item=slug
 * Item anchor takes priority on initial load: we still apply filters but
 * also scroll/open the requested entry. We use replaceState to avoid
 * polluting the back button with every keystroke. */

function readHashState() {
  const h = location.hash.replace(/^#/, "");
  const params = new URLSearchParams(h);
  return {
    q: params.get("q") || "",
    s: (params.get("s") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    item: params.get("item") || "",
  };
}

let lastHashWritten = null; // null = no write yet, force the first one through
function writeHashState() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.enabled.size > 0) params.set("s", [...state.enabled].join(","));
  const next = params.toString();
  if (next === lastHashWritten) return;
  lastHashWritten = next;
  const url = next ? `#${next}` : location.pathname + location.search;
  history.replaceState(null, "", url);
}

function applyHashState() {
  const h = readHashState();
  state.query = h.q;
  state.enabled = new Set(h.s.filter((x) => x === "TBD" || SANCTION_ORDER.includes(x)));
  el.q.value = state.query;
  syncFilterChips();
  state.pendingItemAnchor = h.item || null;
  // Reset the dedupe sentinel so the next user-driven mutation always
  // writes a normalised hash, even if the new value coincidentally
  // matches whatever the URL happened to contain on load.
  lastHashWritten = null;
  render();
}

/* ---------- Events ---------- */

function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const onQueryInput = debounce((value) => {
  state.query = value;
  writeHashState();
  render();
  if (el.list.firstElementChild) {
    el.list.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}, 60);

function bindEvents() {
  el.q.addEventListener("input", (e) => onQueryInput(e.target.value));

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
    writeHashState();
    render();
  });

  const doReset = () => {
    state.query = "";
    state.enabled.clear();
    el.q.value = "";
    syncFilterChips();
    writeHashState();
    render();
  };
  el.reset.addEventListener("click", doReset);
  if (el.emptyReset) el.emptyReset.addEventListener("click", doReset);

  // Listen to hash changes so external links / browser nav update state.
  window.addEventListener("hashchange", () => applyHashState());

  // Click on per-item "Link a questa voce" copies the URL to clipboard.
  el.list.addEventListener("click", (e) => {
    const a = e.target.closest(".item-share");
    if (!a) return;
    e.preventDefault();
    const url = new URL(a.getAttribute("href"), location.href).href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flashShare(a, "Link copiato"),
        () => flashShare(a, "Copia non riuscita"),
      );
    } else {
      // Fall back to navigation; user can copy from the address bar.
      location.hash = a.getAttribute("href");
    }
  });

  // Sticky topbar condense on scroll. We toggle a class on <html> instead of
  // listening per-frame so CSS can decide what to hide/shrink.
  const onScroll = () => {
    const scrolled = window.scrollY > 32;
    document.documentElement.classList.toggle("is-scrolled", scrolled);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Drop the right-edge fade mask once the chip strip has been scrolled to
  // the very end so users don't see a phantom hint that more content is
  // off-screen when, in fact, everything is already visible.
  const onChipScroll = () => {
    const atEnd = el.filters.scrollLeft + el.filters.clientWidth >= el.filters.scrollWidth - 1;
    el.filters.dataset.overflow = atEnd ? "end" : "mid";
  };
  el.filters.addEventListener("scroll", onChipScroll, { passive: true });
  // Re-evaluate on resize — narrowing the viewport may make a previously
  // fully-visible strip overflow again.
  window.addEventListener("resize", onChipScroll, { passive: true });
  onChipScroll();

  // Force-open every <details> at print time so judges can produce a
  // complete paper copy, then restore the prior state. Cheaper than
  // rendering twice and survives both Ctrl+P and "Save as PDF".
  let printSnapshot = null;
  window.addEventListener("beforeprint", () => {
    const all = el.list.querySelectorAll("details");
    printSnapshot = [...all].map((d) => d.open);
    all.forEach((d) => (d.open = true));
  });
  window.addEventListener("afterprint", () => {
    if (!printSnapshot) return;
    el.list.querySelectorAll("details").forEach((d, i) => {
      if (printSnapshot[i] !== undefined) d.open = printSnapshot[i];
    });
    printSnapshot = null;
  });
}

function flashShare(node, text) {
  const original = node.textContent;
  node.textContent = text;
  node.classList.add("is-flashed");
  setTimeout(() => {
    node.textContent = original;
    node.classList.remove("is-flashed");
  }, 1400);
}

function setUpdated(headerValue) {
  if (!el.updated) return;
  if (!headerValue) {
    el.updated.hidden = true;
    return;
  }
  const d = new Date(headerValue);
  if (Number.isNaN(d.valueOf())) {
    el.updated.hidden = true;
    return;
  }
  const fmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  el.updated.textContent = `Aggiornato: ${fmt.format(d)}`;
  el.updated.hidden = false;
}

async function init() {
  renderFilterChips();
  bindEvents();
  try {
    const resp = await fetch("./data/vademecum.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const lastMod = resp.headers.get("last-modified");
    const data = await resp.json();
    state.items = Array.isArray(data) ? data : data.items || [];
    el.loading.hidden = true;
    setUpdated(lastMod);
    applyHashState();
  } catch (err) {
    console.error("vademecum load failed:", err);
    el.loading.textContent = "Errore nel caricamento del vademecum.";
  }
}

init();

/* ---------- Service worker update notification ----------
 * When the deploy stamps a new VERSION, the new SW reaches `installed` and
 * waits in the `waiting` slot. We surface a non-blocking toast so the judge
 * can opt into the refresh at a moment that doesn't disrupt a ruling
 * lookup, instead of forcing skipWaiting() server-side and yanking the page
 * mid-tap. */
function showSwUpdate(reg) {
  if (!el.swUpdate || !el.swUpdateBtn || !reg || !reg.waiting) return;
  el.swUpdate.hidden = false;
  el.swUpdateBtn.addEventListener(
    "click",
    () => {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    },
    { once: true },
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        if (reg.waiting) showSwUpdate(reg);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              showSwUpdate(reg);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });

    // When the new SW takes control after SKIP_WAITING, reload once so the
    // page is rebuilt with the fresh cache. Guard against reload loops.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
}
