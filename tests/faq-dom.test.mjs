/* DOM smoke test for the FAQ page: boots faq.js inside jsdom against a small
 * card-centric fixture and exercises render (card header + image + text +
 * rulings + Q&A accordion), search filtering and hash deep-linking. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FIXTURE = [
  {
    title: "Magic of the Smith",
    image: "./assets/cards/magic-of-the-smith.jpg",
    text: "+1 stealth action. [tha] Search your library for an equipment card and equip this vampire with it.",
    url: "https://vdb.im/cards/101143",
    rulingsUrl: "https://rulings.krcg.org/index.html?uid=101143",
    rulings: [
      {
        text: "The equipment need not be declared, it is chosen upon resolution.",
        source: "VEKN forum",
        url: "https://www.vekn.net/forum/rules-questions/69865-action-declaration-on-magic-of-the-smith",
      },
    ],
    faqs: [
      { question: "Conta come una normale azione di equip?", answer: "No, è un'azione distinta." },
      { question: "Va dichiarato l'equipaggiamento?", answer: "No, si sceglie alla risoluzione." },
    ],
  },
  {
    title: "Torpor",
    faqs: [{ question: "Un vampiro in torpor può bloccare?", answer: "No, non può agire né bloccare." }],
  },
];

const TOTAL_FAQS = FIXTURE.reduce((n, g) => n + g.faqs.length, 0);

/** @param {number} [ms] */
function tick(ms = 0) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @param {{ fetchImpl?: (input: any) => Promise<any> }} [opts] */
async function bootFaq(opts = {}) {
  const { fetchImpl } = opts;
  const html = readFileSync(resolve(ROOT, "faq.html"), "utf8").replace(
    /<script[^>]*src="assets\/faq\.js"[^>]*><\/script>/,
    "",
  );

  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;

  const bridge = ["window", "document", "navigator", "location", "history", "HTMLElement", "Event", "Node"];
  for (const k of bridge) {
    Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true });
  }
  globalThis.requestAnimationFrame = /** @type {typeof requestAnimationFrame} */ (
    /** @type {unknown} */ ((/** @type {FrameRequestCallback} */ fn) => setTimeout(fn, 0))
  );
  window.HTMLElement.prototype.scrollIntoView = function () {};

  const defaultFetch = async (/** @type {unknown} */ input) => {
    if (String(input).includes("faq.json")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        async json() {
          return FIXTURE;
        },
      };
    }
    return { ok: false, status: 404, headers: { get: () => null } };
  };
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchImpl || defaultFetch));

  const origWarn = console.warn;
  const origError = console.error;
  console.warn = () => {};
  console.error = () => {};

  const url = pathToFileURL(resolve(ROOT, "assets/faq.js")).href + `?t=${Date.now()}`;
  await import(url);
  await tick(20);

  console.warn = origWarn;
  console.error = origError;
  return { dom, window };
}

test("FAQ DOM smoke: card layout, search, reset, deep-link", async () => {
  const { window } = await bootFaq();
  const { document } = window;

  const list = /** @type {HTMLElement} */ (document.getElementById("list"));
  const empty = /** @type {HTMLElement} */ (document.getElementById("empty"));
  const count = /** @type {HTMLElement} */ (document.getElementById("count"));
  const loading = /** @type {HTMLElement} */ (document.getElementById("loading"));
  const q = /** @type {HTMLInputElement} */ (document.getElementById("q"));
  const reset = /** @type {HTMLButtonElement} */ (document.getElementById("reset"));

  assert.equal(loading.hidden, true, "loading hides after load");
  assert.equal(empty.hidden, true, "empty hidden when fixture has rows");
  assert.match(count.textContent || "", new RegExp(`${TOTAL_FAQS} voci`));

  // One card section per group; one accordion <details> per question.
  assert.equal(list.querySelectorAll(".faq-card").length, FIXTURE.length, "one card per group");
  assert.equal(list.querySelectorAll("details.item").length, TOTAL_FAQS, "one accordion item per question");
  assert.equal(list.querySelectorAll(".faq-card-title").length, FIXTURE.length, "each card has a title header");

  // Card-specific extras render only for the group that carries them.
  const img = /** @type {HTMLImageElement | null} */ (list.querySelector("img.faq-card-img"));
  assert.ok(img, "card image rendered");
  assert.equal(img.getAttribute("src"), "./assets/cards/magic-of-the-smith.jpg");
  assert.match(img.getAttribute("alt") || "", /Magic of the Smith/);

  assert.match(list.querySelector(".faq-card-text")?.textContent || "", /stealth action/);

  const rulings = list.querySelectorAll(".faq-rulings-acc .faq-ruling");
  assert.equal(rulings.length, 1, "one ruling rendered");
  assert.ok(list.querySelector("details.faq-rulings-acc"), "rulings are a nested accordion");
  const srcLink = /** @type {HTMLAnchorElement | null} */ (
    list.querySelector('.faq-ruling-src[href*="vekn.net/forum"]')
  );
  assert.ok(srcLink, "ruling source link rendered");

  const vdbLink = /** @type {HTMLAnchorElement | null} */ (list.querySelector('a.item-ref[href^="https://vdb.im/"]'));
  assert.ok(vdbLink, "VDB link rendered");
  assert.equal(vdbLink.getAttribute("href"), "https://vdb.im/cards/101143");
  assert.equal(vdbLink.getAttribute("target"), "_blank");

  const krcgLink = /** @type {HTMLAnchorElement | null} */ (
    list.querySelector('a.item-ref[href^="https://rulings.krcg.org/"]')
  );
  assert.ok(krcgLink, "KRCG rulings link rendered");
  assert.equal(krcgLink.getAttribute("href"), "https://rulings.krcg.org/index.html?uid=101143");

  // ---- Search filter (matches a whole group) ----
  q.value = "torpor";
  q.dispatchEvent(new window.Event("input", { bubbles: true }));
  await tick(120);
  assert.equal(list.querySelectorAll(".faq-card").length, 1, "only the matching card stays");
  assert.match(list.querySelector(".faq-card-title")?.textContent || "", /Torpor/);
  assert.ok(list.querySelector("mark"), "query substring highlighted");
  assert.match(count.textContent || "", new RegExp(`1 / ${TOTAL_FAQS}`));
  assert.equal(reset.hidden, false);

  // ---- Reset ----
  reset.click();
  await tick(20);
  assert.equal(q.value, "");
  assert.equal(list.querySelectorAll(".faq-card").length, FIXTURE.length);

  // ---- Deep-link to a question ----
  const slug = "magic-of-the-smith-conta-come-una-normale-azione-di-equip";
  window.location.hash = `#item=${slug}`;
  window.dispatchEvent(new window.Event("hashchange"));
  await tick(40);
  const target = /** @type {HTMLDetailsElement | null} */ (document.getElementById(`faq-${slug}`));
  assert.ok(target, "deep-linked question rendered");
  assert.equal(target.open, true, "deep-linked question auto-opened");
});

test("FAQ DOM smoke: an empty dataset shows the 'no FAQ yet' state, not the filter message", async () => {
  const { window } = await bootFaq({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      async json() {
        return [];
      },
    }),
  });
  const { document } = window;
  const empty = /** @type {HTMLElement} */ (document.getElementById("empty"));
  const emptyMsg = /** @type {HTMLElement} */ (document.getElementById("empty-msg"));
  const emptyActions = /** @type {HTMLElement} */ (document.getElementById("empty-actions"));
  assert.equal(empty.hidden, false, "empty state visible with no data");
  assert.match(emptyMsg.textContent || "", /non ci sono ancora faq/i);
  assert.equal(emptyActions.hidden, true, "no 'Azzera filtri' button when there's no data to filter");
});

test("FAQ DOM smoke: 404 surfaces a 'not found' message", async () => {
  const { window } = await bootFaq({
    fetchImpl: async () => ({ ok: false, status: 404, headers: { get: () => null } }),
  });
  const loading = /** @type {HTMLElement} */ (window.document.getElementById("loading"));
  assert.equal(loading.hidden, false);
  assert.match(loading.textContent || "", /404/);
  assert.ok(loading.classList.contains("is-error"));
});

test("FAQ DOM smoke: invalid group dropped, valid groups survive partial validation", async () => {
  const { window } = await bootFaq({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      async json() {
        return [...FIXTURE, { title: "", faqs: [] }];
      },
    }),
  });
  const list = /** @type {HTMLElement} */ (window.document.getElementById("list"));
  assert.equal(list.querySelectorAll(".faq-card").length, FIXTURE.length, "bad group dropped, good ones kept");
});
