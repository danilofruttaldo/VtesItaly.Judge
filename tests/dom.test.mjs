/* DOM smoke test: boots app.js inside jsdom against a small fixture and
 * exercises the user flow end-to-end. Catches the regressions that pure
 * unit tests on core.mjs miss — render output, event wiring, hash routing,
 * filter UX. The test deliberately runs as a single linear scenario so we
 * only pay the import-cost of app.js once. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FIXTURE = [
  {
    category: "Deck",
    infraction: "Buste segnate (senza schema)",
    reference: "131",
    sanction: "CAUTION",
    description: "Marcatura accidentale di buste protettive.",
    example: "Sleeve graffiata; angolo piegato.",
    philosophy: "",
    correzione: "Sostituire le buste danneggiate.",
  },
  {
    category: "Deck",
    infraction: "Buste segnate (con schema)",
    reference: "132",
    sanction: "GAME LOSS",
    description: "Pattern di marcature riconoscibile dal retro.",
    example: "",
    philosophy: "",
    correzione: "",
  },
  {
    category: "Condotta impropria",
    infraction: "Slow play",
    reference: "141 - 162",
    sanction: "CAUTION - GAME LOSS",
    description: "Tempo eccessivo per le decisioni.",
    example: "Esitazioni prolungate quando il vantaggio sul tempo è già acquisito.",
    philosophy: "",
    correzione: "Avviso e monitoraggio.",
  },
];

/** @param {number} [ms] */
function tick(ms = 0) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {{ fetchImpl?: (input: any) => Promise<any> }} [opts]
 */
async function bootApp(opts = {}) {
  const { fetchImpl } = opts;
  const html = readFileSync(resolve(ROOT, "index.html"), "utf8")
    // Strip the module script tag — JSDOM's module-script support is limited
    // and we want to drive app.js from this process so we can wire mocks.
    .replace(/<script[^>]*src="assets\/app\.js"[^>]*><\/script>/, "");

  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;

  // Bridge jsdom globals onto globalThis so app.js (executed in this Node
  // process) resolves identifiers like `document`, `location`, `history`
  // against the simulated DOM rather than Node's defaults.
  const bridge = ["window", "document", "navigator", "location", "history", "HTMLElement", "Event", "Node"];
  for (const k of bridge) {
    Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true });
  }
  globalThis.requestAnimationFrame = /** @type {typeof requestAnimationFrame} */ (
    /** @type {unknown} */ ((/** @type {FrameRequestCallback} */ fn) => setTimeout(fn, 0))
  );
  // jsdom doesn't implement scrollIntoView — stub it so revealItem() doesn't throw.
  window.HTMLElement.prototype.scrollIntoView = function () {};

  // Default fetch returns the fixture; tests can inject other implementations
  // (404, malformed JSON, validation failure) to exercise the error branches.
  const defaultFetch = async (/** @type {unknown} */ input) => {
    if (String(input).includes("vademecum.json")) {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (/** @type {string} */ k) =>
            k.toLowerCase() === "last-modified" ? "Mon, 27 Apr 2026 10:00:00 GMT" : null,
        },
        async json() {
          return FIXTURE;
        },
      };
    }
    return { ok: false, status: 404, headers: { get: () => null } };
  };
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchImpl || defaultFetch));

  // Suppress expected console noise for negative tests; positive tests don't
  // log so this is a no-op in the happy path.
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = () => {};
  console.error = () => {};

  // Cache-bust the dynamic import so this boot is independent from any
  // previous test runs in the same process.
  const url = pathToFileURL(resolve(ROOT, "assets/app.js")).href + `?t=${Date.now()}`;
  await import(url);

  // Allow the fetch-then-render microtask chain to settle, plus the
  // requestAnimationFrame stub timeouts queued by render().
  await tick(20);

  console.warn = origWarn;
  console.error = origError;
  return { dom, window };
}

test("DOM smoke: full user flow on a small fixture", async () => {
  const { window } = await bootApp();
  const { document } = window;

  // ---- Initial render ----
  const list = /** @type {HTMLElement} */ (document.getElementById("list"));
  const empty = /** @type {HTMLElement} */ (document.getElementById("empty"));
  const count = /** @type {HTMLElement} */ (document.getElementById("count"));
  const loading = /** @type {HTMLElement} */ (document.getElementById("loading"));
  const q = /** @type {HTMLInputElement} */ (document.getElementById("q"));
  const reset = /** @type {HTMLButtonElement} */ (document.getElementById("reset"));

  assert.equal(loading.hidden, true, "loading row hides after data load");
  assert.equal(empty.hidden, true, "empty state hidden when fixture has rows");
  assert.match(count.textContent || "", /\d+ voci/);

  const cards = list.querySelectorAll("details.item");
  assert.equal(cards.length, FIXTURE.length, "one card per fixture entry");

  // Sanction filter chips were removed; there should be no chip-group element.
  assert.equal(document.getElementById("sanction-filters"), null, "filter chip group is gone");
  assert.equal(list.parentElement?.querySelectorAll(".chip").length, 0, "no chip elements rendered");

  // Reference link is wired
  const refLinks = list.querySelectorAll(".item-ref");
  assert.ok(refLinks.length >= 1, "at least one rendered reference link");

  // Example sections render only for entries that have a non-empty example.
  const exampleSections = list.querySelectorAll(".item-section-example");
  assert.equal(exampleSections.length, 2, "two fixture entries have an example, one doesn't");
  assert.match(exampleSections[0].textContent || "", /Example/);

  // Definition section uses the VEKN literal label.
  const defSections = list.querySelectorAll(".item-section-def");
  assert.ok(defSections.length >= 1, "at least one Definition rendered");
  assert.match(defSections[0].textContent || "", /Definition/);

  // Penalty is always rendered (one per card). The empty-correzione entry
  // shows the "Nessuna azione" fallback and gets the empty modifier class.
  const penaltySections = list.querySelectorAll(".item-section-penalty");
  assert.equal(penaltySections.length, FIXTURE.length, "Penalty rendered for every card");
  assert.match(penaltySections[0].textContent || "", /Penalty/);
  const emptyPenalty = list.querySelectorAll(".item-section-penalty-empty");
  assert.equal(emptyPenalty.length, 1, "one fixture entry has no correzione");
  assert.match(emptyPenalty[0].textContent || "", /Nessuna azione specifica/);

  // Multi-sanction badge: range is now expanded to all intermediate steps
  // (CAUTION → WARNING → GAME LOSS = 3 pills + 2 separators).
  const slowCard = [...cards].find((c) => /slow play/i.test(c.querySelector(".item-title")?.textContent || ""));
  assert.ok(slowCard, "slow play card present");
  assert.ok(slowCard.classList.contains("item-multi"), "multi-sanction class on multi entry");
  const slowBadges = slowCard.querySelectorAll(".item-summary .badge:not(.badge-tbd)");
  assert.equal(slowBadges.length, 3, "expanded range yields 3 sanction pills");
  assert.equal(slowCard.querySelectorAll(".badge-sep").length, 2, "2 separators between 3 pills");

  // ---- Search filter ----
  q.value = "slow";
  q.dispatchEvent(new window.Event("input", { bubbles: true }));
  await tick(120); // debounce is 60ms; allow margin

  const filteredCards = list.querySelectorAll("details.item");
  assert.equal(filteredCards.length, 1);
  assert.match(filteredCards[0].querySelector(".item-title")?.textContent || "", /Slow play/i);
  // The matched substring is wrapped in <mark> for highlighting
  assert.ok(filteredCards[0].querySelector("mark"), "query substring is highlighted");
  // Reset becomes available
  assert.equal(reset.hidden, false);

  // ---- Reset ----
  reset.click();
  await tick(20);
  assert.equal(q.value, "");
  assert.equal(list.querySelectorAll("details.item").length, FIXTURE.length);
  assert.equal(reset.hidden, true);

  // ---- Hash deep-link to an item ----
  const targetSlug = "deck-buste-segnate-con-schema";
  window.location.hash = `#item=${targetSlug}`;
  window.dispatchEvent(new window.Event("hashchange"));
  await tick(40);

  const target = /** @type {HTMLDetailsElement | null} */ (document.getElementById(`item-${targetSlug}`));
  assert.ok(target, "deep-linked item is rendered");
  assert.equal(target.open, true, "deep-linked item is auto-opened");

  // ---- Hash query encoding ----
  window.location.hash = "#q=con%20schema";
  window.dispatchEvent(new window.Event("hashchange"));
  await tick(40);

  assert.equal(q.value, "con schema");
  const hashFiltered = list.querySelectorAll("details.item");
  assert.equal(hashFiltered.length, 1);
  assert.match(hashFiltered[0].querySelector(".item-title")?.textContent || "", /Buste segnate \(con schema\)/i);
});

test("DOM smoke: 404 surfaces a 'not found' message in the loading row", async () => {
  const { window } = await bootApp({
    fetchImpl: async () => ({ ok: false, status: 404, headers: { get: () => null } }),
  });
  const loading = /** @type {HTMLElement} */ (window.document.getElementById("loading"));
  assert.equal(loading.hidden, false);
  assert.match(loading.textContent || "", /404/);
  assert.ok(loading.classList.contains("is-error"));
});

test("DOM smoke: malformed JSON surfaces a corruption message", async () => {
  const { window } = await bootApp({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      async json() {
        const e = new SyntaxError("Unexpected token");
        throw e;
      },
    }),
  });
  const loading = /** @type {HTMLElement} */ (window.document.getElementById("loading"));
  assert.equal(loading.hidden, false);
  assert.match(loading.textContent || "", /JSON non valido/i);
});

test("DOM smoke: schema-invalid payload surfaces a format error", async () => {
  const { window } = await bootApp({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      async json() {
        return [{ category: "", infraction: "", reference: "x", sanction: "MEGA" }]; // every row invalid
      },
    }),
  });
  const loading = /** @type {HTMLElement} */ (window.document.getElementById("loading"));
  assert.equal(loading.hidden, false);
  assert.match(loading.textContent || "", /formato non valido/i);
});

test("DOM smoke: partial validation drops bad rows but keeps the page useful", async () => {
  const { window } = await bootApp({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      async json() {
        return [
          ...FIXTURE,
          {
            category: "",
            infraction: "",
            reference: "x",
            sanction: "MEGA",
            description: "",
            example: "",
            philosophy: "",
            correzione: "",
          },
        ];
      },
    }),
  });
  const list = /** @type {HTMLElement} */ (window.document.getElementById("list"));
  assert.equal(list.querySelectorAll("details.item").length, FIXTURE.length, "bad row dropped, good rows kept");
  const loading = /** @type {HTMLElement} */ (window.document.getElementById("loading"));
  assert.equal(loading.hidden, true, "partial validation does not mask the page");
});
