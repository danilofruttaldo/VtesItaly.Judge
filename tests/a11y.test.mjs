/* axe-core a11y regression: boots the app inside jsdom, runs axe-core
 * against the rendered DOM, and fails if any critical/serious violation
 * appears. Lighthouse already runs in CI but only catches a subset of
 * WCAG rules and only against the static index.html — this test runs
 * against the *fully hydrated* DOM (cards rendered, search overlay live),
 * which is what a real judge interacts with during a tournament. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import axe from "axe-core";

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

async function bootApp() {
  const html = readFileSync(resolve(ROOT, "index.html"), "utf8").replace(
    /<script[^>]*src="assets\/app\.js"[^>]*><\/script>/,
    "",
  );

  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;

  const bridge = ["window", "document", "navigator", "location", "history", "HTMLElement", "Event", "Node"];
  for (const k of bridge) {
    Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true });
  }
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  window.HTMLElement.prototype.scrollIntoView = function () {};

  const fetchImpl = async (/** @type {unknown} */ input) => {
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
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchImpl));

  const url = pathToFileURL(resolve(ROOT, "assets/app.js")).href + `?t=${Date.now()}`;
  await import(url);

  // Let render queue settle (fetch microtask + the rAF stub setTimeouts).
  await new Promise((r) => setTimeout(r, 30));
  return { dom, window };
}

test("axe-core: hydrated DOM has no critical or serious WCAG violations", async () => {
  const { window } = await bootApp();

  // Inject axe into the jsdom window so it operates on the real document.
  // axe-core ships its runtime as a string on the default export's `source`
  // property — eval'ing it in the window context attaches `window.axe`.
  window.eval(axe.source);

  const results = await window.axe.run(window.document, {
    // Stay strict on impact level; jsdom doesn't paint, so colour-contrast
    // is unreliable and is excluded — Lighthouse covers that against the
    // real rendered page.
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: {
      "color-contrast": { enabled: false },
    },
  });

  /** @type {import('axe-core').Result[]} */
  const blocking = results.violations.filter(
    (/** @type {import('axe-core').Result} */ v) => v.impact === "critical" || v.impact === "serious",
  );

  if (blocking.length > 0) {
    const summary = blocking
      .map(
        (v) =>
          `  • [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})\n      see: ${v.helpUrl}`,
      )
      .join("\n");
    assert.fail(`axe-core found ${blocking.length} blocking violation(s):\n${summary}`);
  }
});
