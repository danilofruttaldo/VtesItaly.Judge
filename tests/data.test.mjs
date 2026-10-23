/* Gates the real data/vademecum.json against the canonical schema in
 * core.mjs. Any malformed entry in the published dataset breaks CI. The
 * test is intentionally separate from core.test.mjs so the failure
 * surface is unambiguous: "data" failure = bad content, "core" failure
 * = bad code. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { faqSlug, itemSlug, validateData, validateFaqData, countFaqs } from "../assets/core.mjs";
import { parseJudges } from "../scripts/fetch-judges.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = readFileSync(resolve(ROOT, "data/vademecum.json"), "utf8");
const RAW_JUDGES = readFileSync(resolve(ROOT, "data/judges.json"), "utf8");
const RAW_FAQ = readFileSync(resolve(ROOT, "data/faq.json"), "utf8");

test("data/vademecum.json is valid JSON", () => {
  assert.doesNotThrow(() => JSON.parse(RAW));
});

test("data/vademecum.json conforms to the entry schema", () => {
  const data = JSON.parse(RAW);
  const { entries, issues } = validateData(data);
  if (issues.length > 0) {
    const summary = issues
      .map((i) => `  [${i.index}] ${i.errors.join("; ")}`)
      .slice(0, 10)
      .join("\n");
    assert.fail(
      `data/vademecum.json has ${issues.length} invalid entr${issues.length === 1 ? "y" : "ies"}:\n${summary}`,
    );
  }
  assert.equal(entries.length, data.length);
});

test("data/vademecum.json has at least one entry per declared category-infraction pair (no duplicates)", () => {
  const data = JSON.parse(RAW);
  /** @type {Map<string, number>} */
  const seen = new Map();
  /** @type {{ first: number | undefined, second: number, key: string }[]} */
  const dups = [];
  data.forEach((/** @type {{ category: string, infraction: string }} */ e, /** @type {number} */ i) => {
    const key = `${e.category}\n${e.infraction}`;
    if (seen.has(key)) dups.push({ first: seen.get(key), second: i, key });
    else seen.set(key, i);
  });
  if (dups.length) {
    assert.fail(
      `Duplicate (category, infraction) pairs:\n` +
        dups.map((d) => `  rows ${d.first} & ${d.second}: ${JSON.stringify(d.key.split("\n"))}`).join("\n"),
    );
  }
});

test("data/faq.json is valid JSON", () => {
  assert.doesNotThrow(() => JSON.parse(RAW_FAQ));
});

test("data/faq.json conforms to the FAQ group schema", () => {
  const data = JSON.parse(RAW_FAQ);
  const { groups, issues } = validateFaqData(data);
  if (issues.length > 0) {
    const summary = issues
      .map((i) => `  [${i.index}] ${i.errors.join("; ")}`)
      .slice(0, 10)
      .join("\n");
    assert.fail(`data/faq.json has ${issues.length} invalid group${issues.length === 1 ? "" : "s"}:\n${summary}`);
  }
  assert.equal(groups.length, data.length);
  assert.ok(countFaqs(groups) > 0, "at least one question across all groups");
});

test("data/faq.json has no duplicate (title, question) pairs across groups", () => {
  const data = JSON.parse(RAW_FAQ);
  /** @type {Map<string, string>} */
  const seen = new Map();
  /** @type {string[]} */
  const dups = [];
  data.forEach((/** @type {{ title: string, faqs: { question: string }[] }} */ g) => {
    (g.faqs || []).forEach((qa) => {
      const key = `${g.title}\n${qa.question}`;
      if (seen.has(key)) dups.push(JSON.stringify([g.title, qa.question]));
      else seen.set(key, g.title);
    });
  });
  if (dups.length) {
    assert.fail(`Duplicate (title, question) pairs:\n  ${dups.join("\n  ")}`);
  }
});

test("data/faq.json yields unique faqSlug values across all questions (deep-link safety)", () => {
  const data = JSON.parse(RAW_FAQ);
  /** @type {Map<string, string>} */
  const bySlug = new Map();
  /** @type {string[]} */
  const dups = [];
  data.forEach((/** @type {{ title: string, faqs: { question: string }[] }} */ g) => {
    (g.faqs || []).forEach((qa) => {
      const slug = faqSlug(g.title, qa.question);
      if (bySlug.has(slug)) dups.push(`${slug} (${g.title} / ${qa.question})`);
      else bySlug.set(slug, g.title);
    });
  });
  if (dups.length) {
    assert.fail(`Duplicate faqSlug values:\n  ${dups.join("\n  ")}`);
  }
});

test("data/judges.json is valid JSON with required envelope and at least one judge", () => {
  const payload = JSON.parse(RAW_JUDGES);
  assert.equal(typeof payload, "object");
  assert.equal(payload.country, "Italy");
  assert.ok(/^https:\/\//.test(payload.source), "source must be an https URL");
  assert.match(payload.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.ok(Array.isArray(payload.judges) && payload.judges.length > 0, "judges array must be non-empty");
  for (const j of payload.judges) {
    assert.ok(j.name && typeof j.name === "string", `name missing: ${JSON.stringify(j)}`);
    assert.match(j.vekn_id, /^\d+$/, `bad vekn_id: ${JSON.stringify(j)}`);
    assert.ok(j.rank && typeof j.rank === "string", `rank missing: ${JSON.stringify(j)}`);
    assert.match(j.valid_from, /^\d{4}-\d{2}-\d{2}$/, `bad valid_from: ${JSON.stringify(j)}`);
    assert.match(j.valid_to, /^\d{4}-\d{2}-\d{2}$/, `bad valid_to: ${JSON.stringify(j)}`);
  }
});

test("parseJudges() reads the inline guardians array of vtesexams.com", () => {
  // Synthetic page — the shape vtesexams.com serves: an inline JSON array
  // feeding the map. Failing this test signals a parser regression, not a
  // data-source change.
  const fixture = `
    <script>
      const toggle = document.querySelector('.menu-toggle');
      const guardians = [{"veknNumber":"1234567","displayName":"Mario Rossi","countryCode":"IT","countryName":"Italy","cityName":"Bologna","judgeRank":"Elder","accreditedOn":"2024-02-01","validUntil":"2027-02-01","directoryOrder":"1"},{"veknNumber":"2345678","displayName":"Jean Dupont]","countryCode":"FR","countryName":"France","cityName":"París","judgeRank":"Ancilla","accreditedOn":"2025-04-03","validUntil":"2028-04-03","directoryOrder":"2"}];
      const map = L.map('guardians-map');
    </script>
  `;
  const it = parseJudges(fixture, "IT");
  assert.ok(it, "guardians array found");
  assert.equal(it.length, 1);
  assert.deepEqual(it[0], {
    name: "Mario Rossi",
    vekn_id: "1234567",
    rank: "Elder Judge",
    valid_from: "2024-02-01",
    valid_to: "2027-02-01",
  });
  assert.equal(
    parseJudges(fixture, "FR")?.[0].name,
    "Jean Dupont]",
    "an unbalanced bracket inside a string does not end the array",
  );
});

test("parseJudges() returns null when the page has no guardians data", () => {
  assert.equal(parseJudges("<html><body>Error: 404 Component not found.</body></html>", "IT"), null);
  assert.equal(parseJudges("<script>const guardians = [{broken</script>", "IT"), null);
});

test("data/vademecum.json yields unique itemSlug values (deep-link safety)", () => {
  // Slugs are derived (norm + truncate to 80 chars) and used as DOM ids
  // for #item=… deep-links. (category, infraction) uniqueness is already
  // gated above, but the slug derivation can in principle collide on
  // long category/infraction prefixes after truncation. A judge sharing
  // a link must always land on the right rule, so we assert no collision
  // on the actual data.
  const data = JSON.parse(RAW);
  /** @type {Map<string, number>} */
  const bySlug = new Map();
  /** @type {{ first: number | undefined, second: number, slug: string }[]} */
  const dups = [];
  data.forEach((/** @type {import("../assets/core.mjs").VademecumEntry} */ e, /** @type {number} */ i) => {
    const slug = itemSlug(e);
    if (bySlug.has(slug)) dups.push({ first: bySlug.get(slug), second: i, slug });
    else bySlug.set(slug, i);
  });
  if (dups.length) {
    assert.fail(
      `Duplicate itemSlug values:\n` +
        dups.map((d) => `  rows ${d.first} & ${d.second}: ${JSON.stringify(d.slug)}`).join("\n"),
    );
  }
});
