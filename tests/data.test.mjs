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

import { validateData } from "../assets/core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = readFileSync(resolve(ROOT, "data/vademecum.json"), "utf8");

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
  const seen = new Map();
  const dups = [];
  data.forEach((e, i) => {
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
