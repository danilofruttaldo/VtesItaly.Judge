/* VTES Italy Judge — page shell shared by every page.
 * Debounce, search shortcuts, offline chip, print expansion, scroll condense
 * and service worker registration with the "update available" toast. No
 * top-level side effects: each page calls what it needs, and the DOM tests
 * can re-import a page script without re-running anything here.
 */

/**
 * @template {(...args: any[]) => any} F
 * @param {F} fn
 * @param {number} ms
 * @returns {((...args: Parameters<F>) => void) & { cancel: () => void }}
 */
export function debounce(fn, ms) {
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

/**
 * Ctrl+K (or Cmd+K) focuses the search box from anywhere on the page; Esc
 * inside the box clears an active query, as the placeholder hints.
 * @param {HTMLInputElement} input
 * @param {{ hasQuery: () => boolean, reset: () => void }} opts
 */
export function bindSearchShortcuts(input, { hasQuery, reset }) {
  window.addEventListener("keydown", (e) => {
    const ke = /** @type {KeyboardEvent} */ (e);
    if ((ke.ctrlKey || ke.metaKey) && !ke.shiftKey && !ke.altKey && ke.key.toLowerCase() === "k") {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }
    if (ke.key === "Escape" && document.activeElement === input && hasQuery()) {
      e.preventDefault();
      reset();
    }
  });
}

/* Online/offline indicator: a footer chip tells judges they're consulting
 * cached data when a tournament's wifi drops mid-ruling. navigator.onLine is
 * unreliable (captive portals, dead routers, SW serving cache all report
 * true), so we actively probe with a cache-busting HEAD on the tiny
 * robots.txt: the SW only handles GET, so the probe always hits the real
 * network and never lands in the runtime cache. */
const PROBE_TIMEOUT_MS = 4000;

async function probeOnline() {
  if (!navigator.onLine) return false;
  if (typeof AbortController !== "function") return true;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const r = await fetch(`./robots.txt?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Wire the #offline chip, if the page has one. */
export function initOfflineIndicator() {
  const chip = document.getElementById("offline");
  if (!chip) return;
  let probeSeq = 0;
  const update = async () => {
    if (!navigator.onLine) {
      chip.hidden = false;
      return;
    }
    const seq = ++probeSeq;
    const online = await probeOnline();
    if (seq !== probeSeq) return;
    chip.hidden = online;
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/** Sticky topbar condense on scroll: a class on <html> lets CSS decide what
 * to hide or shrink, instead of per-frame style work. */
export function bindScrollCondense() {
  const onScroll = () => {
    document.documentElement.classList.toggle("is-scrolled", window.scrollY > 32);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/**
 * Force-open every <details> in `root` at print time so judges get a
 * complete paper copy, then restore the prior state. Cheaper than rendering
 * twice and survives both Ctrl+P and "Save as PDF".
 * @param {HTMLElement} root
 */
export function bindPrintExpand(root) {
  /** @type {boolean[] | null} */
  let snapshot = null;
  const all = () => /** @type {NodeListOf<HTMLDetailsElement>} */ (root.querySelectorAll("details"));
  window.addEventListener("beforeprint", () => {
    const list = all();
    snapshot = [...list].map((d) => d.open);
    list.forEach((d) => {
      d.open = true;
    });
  });
  window.addEventListener("afterprint", () => {
    if (!snapshot) return;
    const snap = snapshot;
    all().forEach((d, i) => {
      if (snap[i] !== undefined) d.open = snap[i];
    });
    snapshot = null;
  });
}

/* When a deploy stamps a new VERSION, the new SW reaches `installed` and
 * waits. A non-blocking toast lets the judge opt into the refresh at a moment
 * that doesn't disrupt a ruling lookup, instead of forcing skipWaiting()
 * server-side and yanking the page mid-tap. */
/** @param {ServiceWorkerRegistration} reg */
function showSwUpdate(reg) {
  const toast = document.getElementById("sw-update");
  const btn = document.getElementById("sw-update-btn");
  const waiting = reg.waiting;
  if (!toast || !btn || !waiting) return;
  toast.hidden = false;
  btn.addEventListener("click", () => waiting.postMessage({ type: "SKIP_WAITING" }), { once: true });
}

/** Register sw.js and surface the #sw-update toast when a new version waits.
 * Registration failures are not fatal: the page works without a SW, the
 * offline cache is a bonus. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const container = navigator.serviceWorker;
  const register = () => {
    // The first install claims the page too: only a page that already had a
    // controller is running stale code and needs the reload.
    const hadController = Boolean(container.controller);
    container
      .register("./sw.js")
      .then((reg) => {
        if (reg.waiting) showSwUpdate(reg);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && container.controller) showSwUpdate(reg);
          });
        });
      })
      .catch((err) => console.warn("SW registration failed:", err));

    // When the new SW takes control after SKIP_WAITING, reload once so the
    // page is rebuilt with the fresh cache. Guard against reload loops.
    let reloaded = false;
    container.addEventListener("controllerchange", () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      location.reload();
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
