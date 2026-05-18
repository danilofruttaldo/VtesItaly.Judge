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

import { itemSlug, validateData } from "../assets/core.mjs";
import { parseJudges } from "../scripts/fetch-judges.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = readFileSync(resolve(ROOT, "data/vademecum.json"), "utf8");
const RAW_JUDGES = readFileSync(resolve(ROOT, "data/judges.json"), "utf8");

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

test("parseJudges() extracts rows from a representative VEKN <tr> block", () => {
  // Synthetic snapshot — exactly the shape VEKN serves (7 <td> per row).
  // Failing this test signals a parser regression, not a data-source change.
  const fixture = `
    <table>
      <tr>
        <td>1.</td><td>Mario Rossi</td><td>1234567</td><td>Italy</td>
        <td>Elder Judge</td><td>01/02/2024</td><td>01/02/2027</td>
      </tr>
      <tr>
        <td>2.</td><td>Jean Dupont</td><td>2345678</td><td>France</td>
        <td>Ancilla Judge</td><td>03/04/2025</td><td>03/04/2028</td>
      </tr>
    </table>
  `;
  const it = parseJudges(fixture, "Italy");
  assert.equal(it.length, 1);
  assert.equal(it[0].name, "Mario Rossi");
  assert.equal(it[0].vekn_id, "1234567");
  assert.equal(it[0].rank, "Elder Judge");
  assert.equal(it[0].valid_from, "2024-02-01");
  assert.equal(it[0].valid_to, "2027-02-01");
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
