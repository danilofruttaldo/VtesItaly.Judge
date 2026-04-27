/* VTES Italy Judge — Vademecum sanzioni.
 * Loads the prebuilt vademecum.json and renders a searchable list grouped
 * by category. Optimized for phone consultation: single column, sticky
 * search box, expandable cards via native <details>.
 */
import {
  SANCTION_LABELS,
  SANCTION_SLUGS,
  escapeHtml,
  highlightHtml,
  itemSlug,
  computeFiltered,
  groupByCategory,
  parseReference,
  parseSanction,
  validateData,
} from "./core.mjs";

const state = {
  items: [],
  query: "",
  pendingItemAnchor: null, // slug of an item to scroll/open on next render
};

const el = {
  q: /** @type {HTMLInputElement} */ (document.getElementById("q")),
  list: /** @type {HTMLElement} */ (document.getElementById("list")),
  empty: /** @type {HTMLElement} */ (document.getElementById("empty")),
  emptyReset: /** @type {HTMLButtonElement | null} */ (document.getElementById("empty-reset")),
  loading: /** @type {HTMLElement} */ (document.getElementById("loading")),
  count: /** @type {HTMLElement} */ (document.getElementById("count")),
  reset: /** @type {HTMLButtonElement} */ (document.getElementById("reset")),
  updated: /** @type {HTMLElement | null} */ (document.getElementById("updated")),
  swUpdate: /** @type {HTMLElement | null} */ (document.getElementById("sw-update")),
  swUpdateBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById("sw-update-btn")),
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

function render() {
  const filtered = computeFiltered(state.items, state.query);
  const total = state.items.length;
  el.count.textContent = filtered.length === total ? `${total} voci` : `${filtered.length} / ${total}`;
  el.reset.hidden = state.query === "";

  if (filtered.length === 0) {
    el.list.innerHTML = "";
    el.empty.hidden = false;
    return;
  }
  el.empty.hidden = true;

  const groups = groupByCategory(filtered);
  // An active query auto-expands all results so the matched terms are
  // visible without an extra tap. Without this, a filtered list would
  // hide everything behind closed accordions on mobile.
  const queryActive = state.query !== "";
  const html = [];
  for (const [category, items] of groups) {
    const open = queryActive ? " open" : "";
    html.push(`<details class="category"${open}>`);
    html.push(
      `<summary class="category-summary"><span class="category-title">${escapeHtml(category)}</span><span class="category-count">${items.length}</span></summary>`,
    );
    html.push(`<div class="category-body">`);
    for (const it of items) {
      const parsed = parseSanction(it.sanction);
      const ref = renderReference(it.reference);
      const slug = itemSlug(it);
      const itemOpen = queryActive ? " open" : "";
      const klass = `item${parsed.kind === "multi" ? " item-multi" : ""}${parsed.kind === "placeholder" ? " item-tbd" : ""}`;
      const titleHtml = highlightHtml(it.infraction, state.query);
      // Card sections mirror the VEKN Judges' Guide subsections:
      //   Definition  → Definizione (when the rule applies)
      //   Example(s)  → Esempio     (concrete table-side cases)
      //   Philosophy  → Filosofia   (rationale of the rule)
      //   Penalty     → Penalità    (procedural correction; severity is the badge)
      // Definizione/Esempio/Filosofia render only if populated. Penalità
      // is always rendered — an empty value reads as "Nessuna azione
      // specifica oltre alla sanzione." so the judge sees explicitly
      // that no extra correction is required beyond the standard penalty.
      const defHtml = it.description ? highlightHtml(it.description, state.query) : "";
      const exHtml = it.example ? highlightHtml(it.example, state.query) : "";
      const phHtml = it.philosophy ? highlightHtml(it.philosophy, state.query) : "";
      const hasPenalty = Boolean(it.correzione && it.correzione.trim());
      const penHtml = hasPenalty
        ? highlightHtml(it.correzione, state.query)
        : `<span class="muted">Nessuna azione specifica oltre alla sanzione.</span>`;
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
      if (defHtml) {
        html.push(
          `<section class="item-section item-section-def"><h3 class="item-section-label">Definizione</h3><div class="item-section-body">${defHtml}</div></section>`,
        );
      }
      if (exHtml) {
        html.push(
          `<section class="item-section item-section-example"><h3 class="item-section-label">Esempio</h3><div class="item-section-body">${exHtml}</div></section>`,
        );
      }
      if (phHtml) {
        html.push(
          `<section class="item-section item-section-philosophy"><h3 class="item-section-label">Filosofia</h3><div class="item-section-body">${phHtml}</div></section>`,
        );
      }
      const penModifier = hasPenalty ? "" : " item-section-penalty-empty";
      html.push(
        `<section class="item-section item-section-penalty${penModifier}"><h3 class="item-section-label">Penalità</h3><div class="item-section-body">${penHtml}</div></section>`,
      );
      // Reference + share controls live at the bottom of the card so the
      // judge reads description and correzione first, then jumps to the
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
  const node = /** @type {HTMLDetailsElement | null} */ (document.getElementById(`item-${slug}`));
  if (!node) return;
  /** @type {HTMLElement | null} */
  let p = node.parentElement;
  while (p) {
    if (p.tagName === "DETAILS") {
      /** @type {HTMLDetailsElement} */ (p).open = true;
    }
    p = p.parentElement;
  }
  node.open = true;
  // Defer scrolling so the layout settles after open=true.
  requestAnimationFrame(() => {
    node.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

/* ---------- URL hash state ---------- *
 * Encodes the search query and a deep-link item slug into location.hash
 * so the user can bookmark/share a query or a specific entry. Format:
 *   #q=text&item=slug
 * Item anchor takes priority on initial load: we still apply the query
 * but also scroll/open the requested entry. We use replaceState to avoid
 * polluting the back button with every keystroke. */

function readHashState() {
  const h = location.hash.replace(/^#/, "");
  const params = new URLSearchParams(h);
  return {
    q: params.get("q") || "",
    item: params.get("item") || "",
  };
}

let lastHashWritten = null; // null = no write yet, force the first one through
function writeHashState() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  const next = params.toString();
  if (next === lastHashWritten) return;
  lastHashWritten = next;
  const url = next ? `#${next}` : location.pathname + location.search;
  history.replaceState(null, "", url);
}

function applyHashState() {
  const h = readHashState();
  state.query = h.q;
  el.q.value = state.query;
  state.pendingItemAnchor = h.item || null;
  // Reset the dedupe sentinel so the next user-driven mutation always
  // writes a normalised hash, even if the new value coincidentally
  // matches whatever the URL happened to contain on load.
  lastHashWritten = null;
  render();
}

/* ---------- Events ---------- */

/**
 * @template {(...args: any[]) => any} F
 * @param {F} fn
 * @param {number} ms
 * @returns {(...args: Parameters<F>) => void}
 */
function debounce(fn, ms) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let t;
  return (...args) => {
    if (t !== undefined) clearTimeout(t);
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
  el.q.addEventListener("input", (e) => onQueryInput(/** @type {HTMLInputElement} */ (e.target).value));

  const doReset = () => {
    state.query = "";
    el.q.value = "";
    writeHashState();
    render();
  };
  el.reset.addEventListener("click", doReset);
  if (el.emptyReset) el.emptyReset.addEventListener("click", doReset);

  // Listen to hash changes so external links / browser nav update state.
  window.addEventListener("hashchange", () => applyHashState());

  // Click on per-item "Link a questa voce" copies the URL to clipboard.
  el.list.addEventListener("click", (e) => {
    const a = /** @type {HTMLAnchorElement | null} */ (/** @type {Element} */ (e.target).closest(".item-share"));
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href") || "";
    const url = new URL(href, location.href).href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flashShare(a, "Link copiato"),
        () => flashShare(a, "Copia non riuscita"),
      );
    } else {
      // Fall back to navigation; user can copy from the address bar.
      location.hash = href;
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

  // Force-open every <details> at print time so judges can produce a
  // complete paper copy, then restore the prior state. Cheaper than
  // rendering twice and survives both Ctrl+P and "Save as PDF".
  /** @type {boolean[] | null} */
  let printSnapshot = null;
  window.addEventListener("beforeprint", () => {
    const all = /** @type {NodeListOf<HTMLDetailsElement>} */ (el.list.querySelectorAll("details"));
    printSnapshot = [...all].map((d) => d.open);
    all.forEach((d) => {
      d.open = true;
    });
  });
  window.addEventListener("afterprint", () => {
    if (!printSnapshot) return;
    const snap = printSnapshot;
    const all = /** @type {NodeListOf<HTMLDetailsElement>} */ (el.list.querySelectorAll("details"));
    all.forEach((d, i) => {
      if (snap[i] !== undefined) d.open = snap[i];
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

/* User-facing error message for the load step. We split the failure modes
 * so the judge knows whether the issue is local (offline / cache miss) or
 * editorial (the deployed JSON is broken) — that changes what they should
 * try next. Console gets the technical detail; the screen stays readable.
 * @param {unknown} err
 * @returns {string}
 */
function loadErrorMessage(err) {
  const e = /** @type {{ name?: string, status?: number }} */ (err || {});
  if (e.name === "DataValidationError") return "Vademecum in formato non valido.";
  if (e.name === "SyntaxError") return "Vademecum corrotto: JSON non valido.";
  if (typeof e.status === "number") {
    if (e.status === 404) return "Vademecum non trovato (404).";
    if (e.status >= 500) return `Errore del server (${e.status}).`;
    return `Errore HTTP ${e.status}.`;
  }
  return "Errore di rete: vademecum non raggiungibile.";
}

async function init() {
  bindEvents();
  try {
    const resp = await fetch("./data/vademecum.json", { cache: "no-cache" });
    if (!resp.ok) {
      const e = /** @type {Error & { status: number }} */ (new Error(`HTTP ${resp.status}`));
      e.status = resp.status;
      throw e;
    }
    const lastMod = resp.headers.get("last-modified");
    const data = await resp.json(); // throws SyntaxError on malformed JSON
    const { entries, issues } = validateData(data);
    if (issues.length > 0) {
      // Surface diagnostics for editors without breaking judges' lookups —
      // valid rows still render. A fully invalid payload (no valid rows)
      // is treated as a hard error so the loading row says something
      // useful instead of a silent empty list.
      console.warn(`vademecum: ${issues.length} invalid entr${issues.length === 1 ? "y" : "ies"} dropped`, issues);
      if (entries.length === 0) {
        const e = new Error("no valid entries");
        e.name = "DataValidationError";
        throw e;
      }
    }
    state.items = entries;
    el.loading.hidden = true;
    setUpdated(lastMod);
    applyHashState();
  } catch (err) {
    console.error("vademecum load failed:", err);
    el.loading.textContent = loadErrorMessage(err);
    el.loading.classList.add("is-error");
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
