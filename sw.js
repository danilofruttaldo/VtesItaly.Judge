/* VTES Italy Judge — service worker
 * Strategy:
 *   - HTML, app.js, styles.css: network-first, fallback to cache
 *     (so code updates reach users without needing a VERSION bump)
 *   - Icons, manifest: cache-first (rarely change)
 *
 * VERSION is rewritten to a UTC timestamp by .github/workflows/deploy.yml on each
 * release, so deployed clients always get a fresh cache key. Local dev keeps "v1".
 */
// `self` is the ServiceWorkerGlobalScope at runtime; cast once so the rest
// of the file can use skipWaiting/clients without per-line annotations.
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// `vademecum.json` is intentionally NOT precached: it's editorial data
// that changes more often than the shell, so locking judges into the
// install-time copy until the next SW VERSION bump risks rulings on
// stale rules. The fetch handler below caches it network-first into
// RUNTIME_CACHE so it's still available offline after the first load.
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/styles.css",
  "./assets/app.js",
  "./assets/core.mjs",
  "./assets/vtes.svg",
  "./assets/favicon.ico",
  "./assets/apple-touch-icon.png",
];

sw.addEventListener("install", (e) => {
  // Don't auto-skipWaiting: we want the page to keep running with the
  // current SW until the user opts in via the "update" toast. The page
  // posts {type:"SKIP_WAITING"} when the judge accepts.
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_FILES).catch(() => {})));
});

sw.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    sw.skipWaiting();
  }
});

sw.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== sw.location.origin) return;

  const isHtml = req.mode === "navigate" || req.destination === "document";
  const isCode = req.destination === "script" || req.destination === "style";
  const isData = url.pathname.endsWith("/vademecum.json");

  if (isHtml || isCode || isData) {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
          }
          return resp;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            if (isHtml) return caches.match("./index.html");
            return new Response("", { status: 504, statusText: "Offline" });
          }),
        ),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
    }),
  );
});
