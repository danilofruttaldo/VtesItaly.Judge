/* VTES Italy Judge — FAQ regolamento.
 * Loads data/faq.json (a card-centric payload: one group per card/topic) and
 * renders, for each group, a header (card name), the optional card image +
 * verbatim card text + official rulings, and below an accordion of
 * question/answer pairs. Shares the vademecum's shell — same DOM ids, Ctrl+K
 * search, hash deep-linking, offline chip and SW-update toast.
 */
import { escapeHtml, highlightHtml, computeFilteredFaq, countFaqs, faqSlug, validateFaqData } from "./core.mjs";

/** @typedef {import("./core.mjs").FaqGroup} FaqGroup */

/** @type {{ groups: FaqGroup[], query: string, pendingItemAnchor: string | null }} */
const state = {
  groups: [],
  query: "",
  pendingItemAnchor: null, // slug of a question to scroll/open on next render
};

const el = {
  q: /** @type {HTMLInputElement} */ (document.getElementById("q")),
  list: /** @type {HTMLElement} */ (document.getElementById("list")),
  empty: /** @type {HTMLElement} */ (document.getElementById("empty")),
  emptyMsg: /** @type {HTMLElement | null} */ (document.getElementById("empty-msg")),
  emptyActions: /** @type {HTMLElement | null} */ (document.getElementById("empty-actions")),
  emptyReset: /** @type {HTMLButtonElement | null} */ (document.getElementById("empty-reset")),
  loading: /** @type {HTMLElement} */ (document.getElementById("loading")),
  count: /** @type {HTMLElement} */ (document.getElementById("count")),
  reset: /** @type {HTMLButtonElement} */ (document.getElementById("reset")),
  offline: /** @type {HTMLElement | null} */ (document.getElementById("offline")),
  swUpdate: /** @type {HTMLElement | null} */ (document.getElementById("sw-update")),
  swUpdateBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById("sw-update-btn")),
};

function render() {
  try {
    renderUnsafe();
  } catch (err) {
    // A render crash (bad data, malformed string in highlight) used to leave
    // the page blank. Log and surface a recoverable error state so the judge
    // can still reset and retry.
    console.error("faq render failed:", err);
    el.list.innerHTML = "";
    el.empty.hidden = true;
    el.loading.hidden = false;
    el.loading.textContent = "Errore di visualizzazione. Premi Azzera e riprova.";
    el.loading.classList.add("is-error");
  }
}

/**
 * @param {FaqGroup} group
 * @param {boolean} queryActive
 */
function renderGroupHtml(group, queryActive) {
  const q = state.query;
  const html = [];
  // The whole card is one accordion: the card name is the summary; the body
  // holds the art + text + rulings and the per-question accordion. Open it
  // automatically while a query is active so matches are visible.
  const groupOpen = queryActive ? " open" : "";
  html.push(`<details class="faq-card"${groupOpen}>`);
  html.push(
    `<summary class="faq-card-summary"><h2 class="faq-card-title">${highlightHtml(group.title, q)}</h2></summary>`,
  );
  html.push(`<div class="faq-card-body">`);

  // Card art beside the verbatim card text.
  if (group.image || group.text) {
    html.push(`<div class="faq-card-head">`);
    if (group.image) {
      html.push(
        `<img class="faq-card-img" src="${escapeHtml(group.image)}" alt="${escapeHtml(group.title || "")}" loading="lazy" decoding="async" />`,
      );
    }
    if (group.text) {
      html.push(`<div class="faq-card-text">${highlightHtml(group.text, q)}</div>`);
    }
    html.push(`</div>`);
  }

  // Link buttons below the card text, before the rulings: VDB card page and
  // the KRCG rulings page.
  if (group.url || group.rulingsUrl) {
    html.push(`<div class="faq-card-link">`);
    if (group.url) {
      html.push(
        `<a class="item-ref" href="${escapeHtml(group.url)}" rel="noopener noreferrer" target="_blank">Apri su VDB ↗</a>`,
      );
    }
    if (group.rulingsUrl) {
      html.push(
        `<a class="item-ref" href="${escapeHtml(group.rulingsUrl)}" rel="noopener noreferrer" target="_blank">Apri su KRCG ↗</a>`,
      );
    }
    html.push(`</div>`);
  }

  // Official rulings (collapsible) with their authoritative source links.
  if (Array.isArray(group.rulings) && group.rulings.length > 0) {
    const items = group.rulings
      .map(
        (r) =>
          `<li class="faq-ruling"><span class="faq-ruling-text">${highlightHtml(r.text, q)}</span> <a class="faq-ruling-src" href="${escapeHtml(r.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(r.source)} ↗</a></li>`,
      )
      .join("");
    const rulingsOpen = queryActive ? " open" : "";
    html.push(
      `<details class="faq-rulings-acc"${rulingsOpen}><summary class="faq-rulings-summary"><span class="faq-card-label">Rulings ufficiali</span><span class="faq-rulings-count">${group.rulings.length}</span></summary><ul class="faq-rulings">${items}</ul></details>`,
    );
  }

  // FAQ accordion for this card/topic.
  html.push(`<div class="faq-card-faqs">`);
  for (const qa of group.faqs || []) {
    const slug = faqSlug(group.title, qa.question);
    const open = queryActive ? " open" : "";
    html.push(`<details id="faq-${escapeHtml(slug)}" class="item"${open}>`);
    html.push(
      `<summary class="item-summary"><span class="item-title">${highlightHtml(qa.question, q)}</span></summary>`,
    );
    html.push(
      `<div class="item-body"><section class="item-section"><div class="item-section-body">${highlightHtml(qa.answer, q)}</div></section></div>`,
    );
    html.push(`</details>`);
  }
  html.push(`</div>`);
  html.push(`</div>`);
  html.push(`</details>`);
  return html.join("");
}

function renderUnsafe() {
  const filtered = computeFilteredFaq(state.groups, state.query);
  const total = countFaqs(state.groups);
  const shown = countFaqs(filtered);
  const isFiltered = shown !== total;
  el.count.textContent = isFiltered ? `${shown} / ${total}` : `${total} voci`;
  el.count.setAttribute(
    "aria-label",
    isFiltered ? `${shown} voci su ${total} corrispondono ai filtri` : `${total} voci totali`,
  );
  el.reset.hidden = state.query === "";

  if (filtered.length === 0) {
    el.list.innerHTML = "";
    // Distinguish "no FAQ published yet" (empty dataset) from "no match for
    // the active query": the first must not show a misleading filter message
    // or a useless "Azzera filtri" button.
    const noData = state.groups.length === 0;
    if (el.emptyMsg) {
      el.emptyMsg.textContent = noData ? "Non ci sono ancora FAQ pubblicate." : "Nessuna FAQ corrisponde ai filtri.";
    }
    if (el.emptyActions) el.emptyActions.hidden = noData;
    el.empty.hidden = false;
    return;
  }
  el.empty.hidden = true;

  // An active query auto-expands the visible questions so matched terms are
  // visible without an extra tap.
  const queryActive = state.query !== "";
  // Safe-HTML contract: renderGroupHtml composes its output exclusively via
  // escapeHtml / highlightHtml on every dynamic value. Do NOT inject raw data
  // strings — route them through escapeHtml.
  el.list.innerHTML = filtered.map((g) => renderGroupHtml(g, queryActive)).join("");

  if (state.pendingItemAnchor) {
    revealItem(state.pendingItemAnchor);
    state.pendingItemAnchor = null;
  }
}

/** @param {string} slug */
function revealItem(slug) {
  const node = /** @type {HTMLDetailsElement | null} */ (document.getElementById(`faq-${slug}`));
  if (!node) return;
  // Open every ancestor <details> (the card accordion) so the question is
  // visible, then the question itself.
  /** @type {HTMLElement | null} */
  let p = node.parentElement;
  while (p) {
    if (p.tagName === "DETAILS") /** @type {HTMLDetailsElement} */ (p).open = true;
    p = p.parentElement;
  }
  node.open = true;
  // Defer scrolling so the layout settles after open=true, and move focus to
  // the summary so keyboard users land inside the active card.
  requestAnimationFrame(() => {
    node.scrollIntoView({ block: "start", behavior: "smooth" });
    const summary = /** @type {HTMLElement | null} */ (node.querySelector(":scope > .item-summary"));
    if (summary) {
      try {
        summary.focus({ preventScroll: true });
      } catch {
        summary.focus();
      }
    }
  });
}

/* ---------- URL hash state ---------- *
 * Encodes the search query and a deep-link question slug into location.hash
 * so the judge can bookmark/share a query or a specific question. Format:
 *   #q=text&item=slug
 * Mirrors app.js so the two pages behave identically. */

function readHashState() {
  const h = location.hash.replace(/^#/, "");
  const params = new URLSearchParams(h);
  return {
    q: params.get("q") || "",
    item: params.get("item") || "",
  };
}

/** @type {string | null} */
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
  lastHashWritten = null;
  render();
}

/* ---------- Events ---------- */

/**
 * @template {(...args: any[]) => any} F
 * @param {F} fn
 * @param {number} ms
 * @returns {((...args: Parameters<F>) => void) & { cancel: () => void }}
 */
function debounce(fn, ms) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let t;
  /** @type {((...args: Parameters<F>) => void) & { cancel?: () => void }} */
  const wrapped = (...args) => {
    if (t !== undefined) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => {
    if (t !== undefined) {
      clearTimeout(t);
      t = undefined;
    }
  };
  return /** @type {((...args: Parameters<F>) => void) & { cancel: () => void }} */ (wrapped);
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
    onQueryInput.cancel();
    state.query = "";
    el.q.value = "";
    writeHashState();
    render();
  };
  el.reset.addEventListener("click", doReset);
  if (el.emptyReset) el.emptyReset.addEventListener("click", doReset);

  window.addEventListener("hashchange", () => applyHashState());

  // Ctrl+K (or Cmd+K) focuses search from anywhere; Esc inside the box clears
  // an active query — same affordance as the vademecum page.
  window.addEventListener("keydown", (e) => {
    const ke = /** @type {KeyboardEvent} */ (e);
    if ((ke.ctrlKey || ke.metaKey) && !ke.shiftKey && !ke.altKey && ke.key.toLowerCase() === "k") {
      e.preventDefault();
      el.q.focus();
      el.q.select();
      return;
    }
    if (ke.key === "Escape" && document.activeElement === el.q && state.query !== "") {
      e.preventDefault();
      doReset();
    }
  });

  // Online/offline indicator. navigator.onLine is unreliable (captive
  // portals, SW serving cache), so we actively probe with a cache-busting
  // URL: the SW's network-first path falls through to a 504 when the real
  // network is down because the unique query string never matches a cache.
  const PROBE_TIMEOUT_MS = 4000;
  let probeSeq = 0;
  const probeOnline = async () => {
    if (!navigator.onLine) return false;
    if (typeof AbortController !== "function") return true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    try {
      const r = await fetch(`./assets/favicon.ico?_=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal,
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
  const updateOnlineState = async () => {
    if (!el.offline) return;
    if (!navigator.onLine) {
      el.offline.hidden = false;
      return;
    }
    const seq = ++probeSeq;
    const online = await probeOnline();
    if (seq !== probeSeq) return;
    el.offline.hidden = online;
  };
  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
  updateOnlineState();

  // Sticky topbar condense on scroll — toggle a class on <html> so CSS
  // decides what to shrink (same hook the vademecum uses).
  const onScroll = () => {
    document.documentElement.classList.toggle("is-scrolled", window.scrollY > 32);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Force-open every <details> at print time so judges can produce a complete
  // paper copy, then restore the prior state.
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

/** User-facing error message for the load step, split by failure mode so the
 * judge knows whether the issue is local (offline / cache miss) or editorial
 * (the deployed JSON is broken).
 * @param {unknown} err
 * @returns {string}
 */
function loadErrorMessage(err) {
  const e = /** @type {{ name?: string, status?: number }} */ (err || {});
  if (e.name === "DataValidationError") return "FAQ in formato non valido.";
  if (e.name === "SyntaxError") return "FAQ corrotte: JSON non valido.";
  if (typeof e.status === "number") {
    if (e.status === 404) return "FAQ non trovate (404).";
    if (e.status >= 500) return `Errore del server (${e.status}).`;
    return `Errore HTTP ${e.status}.`;
  }
  return "Errore di rete: FAQ non raggiungibili.";
}

async function init() {
  bindEvents();
  try {
    // Default cache lets the SW (network-first for faq.json) + HTTP cache
    // decide freshness: latest data online, cached copy offline.
    const resp = await fetch("./data/faq.json");
    if (!resp.ok) {
      const e = /** @type {Error & { status: number }} */ (new Error(`HTTP ${resp.status}`));
      e.status = resp.status;
      throw e;
    }
    const data = await resp.json(); // throws SyntaxError on malformed JSON
    const { groups, issues } = validateFaqData(data);
    if (issues.length > 0) {
      console.warn(`faq: ${issues.length} invalid group${issues.length === 1 ? "" : "s"} dropped`, issues);
      if (groups.length === 0 && data.length > 0) {
        const e = new Error("no valid groups");
        e.name = "DataValidationError";
        throw e;
      }
    }
    state.groups = groups;
    el.loading.hidden = true;
    applyHashState();
  } catch (err) {
    console.error("faq load failed:", err);
    el.loading.textContent = loadErrorMessage(err);
    el.loading.classList.add("is-error");
  }
}

init();

/* ---------- Service worker update notification ----------
 * Mirrors app.js: surface a non-blocking toast when a new SW is waiting so
 * the judge can opt into the refresh instead of being yanked mid-lookup. */
/** @param {ServiceWorkerRegistration | null | undefined} reg */
function showSwUpdate(reg) {
  if (!el.swUpdate || !el.swUpdateBtn || !reg || !reg.waiting) return;
  el.swUpdate.hidden = false;
  const waiting = reg.waiting;
  el.swUpdateBtn.addEventListener(
    "click",
    () => {
      waiting.postMessage({ type: "SKIP_WAITING" });
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

    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
}
