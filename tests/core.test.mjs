import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SANCTION_ORDER,
  JUDGES_GUIDE_URL,
  norm,
  escapeHtml,
  matchSearch,
  matchSanction,
  computeFiltered,
  groupByCategory,
  judgesGuideUrl,
  parseReference,
} from "../assets/core.mjs";

test("norm lowercases and strips diacritics", () => {
  assert.equal(norm("Gädeke"), "gadeke");
  assert.equal(norm("Éloïse"), "eloise");
  assert.equal(norm("Brujah"), "brujah");
});

test("norm handles null/undefined/empty without throwing", () => {
  assert.equal(norm(null), "");
  assert.equal(norm(undefined), "");
  assert.equal(norm(""), "");
});

test("escapeHtml escapes HTML-dangerous characters", () => {
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  assert.equal(escapeHtml(`"quoted"`), "&quot;quoted&quot;");
  assert.equal(escapeHtml("a & b"), "a &amp; b");
});

const sample = [
  { category: "DECK", infraction: "BUSTE SEGNATE", reference: "131", sanction: "CAUTION", notes: "sostituire" },
  { category: "DECK", infraction: "BUSTE SEGNATE CON SCHEMA", reference: "132", sanction: "GAME LOSS", notes: "" },
  {
    category: "CONDOTTA IMPROPRIA",
    infraction: "BARARE",
    reference: "163",
    sanction: "DISQUALIFICATION WITHOUT PRIZE",
    notes: "es. aggiungere pool",
  },
  { category: "CONDOTTA IMPROPRIA", infraction: "AIUTO ESTERNO", reference: "", sanction: "???", notes: "" },
];

test("matchSearch is empty-query permissive", () => {
  assert.equal(matchSearch(sample[0], ""), true);
  assert.equal(matchSearch(sample[0], "   "), true);
});

test("matchSearch matches across infraction, notes, reference, category", () => {
  assert.equal(matchSearch(sample[0], "buste"), true);
  assert.equal(matchSearch(sample[0], "131"), true);
  assert.equal(matchSearch(sample[0], "deck"), true);
  assert.equal(matchSearch(sample[0], "sostituire"), true);
  assert.equal(matchSearch(sample[0], "nonesistente"), false);
});

test("matchSanction with empty filter set matches everything", () => {
  const enabled = new Set();
  for (const it of sample) assert.equal(matchSanction(it, enabled), true);
});

test("matchSanction filters by enabled sanctions", () => {
  const enabled = new Set(["CAUTION"]);
  assert.equal(matchSanction(sample[0], enabled), true);
  assert.equal(matchSanction(sample[1], enabled), false);
});

test("matchSanction routes non-standard sanctions to OTHER bucket", () => {
  const enabled = new Set(["OTHER"]);
  assert.equal(matchSanction(sample[3], enabled), true); // ???
  assert.equal(matchSanction(sample[0], enabled), false); // CAUTION
});

test("computeFiltered combines search + sanction filters", () => {
  const out = computeFiltered(sample, "buste", new Set(["GAME LOSS"]));
  assert.equal(out.length, 1);
  assert.equal(out[0].infraction, "BUSTE SEGNATE CON SCHEMA");
});

test("groupByCategory preserves insertion order and groups items", () => {
  const groups = groupByCategory(sample);
  const keys = [...groups.keys()];
  assert.deepEqual(keys, ["DECK", "CONDOTTA IMPROPRIA"]);
  assert.equal(groups.get("DECK").length, 2);
  assert.equal(groups.get("CONDOTTA IMPROPRIA").length, 2);
});

test("SANCTION_ORDER has the five canonical sanctions", () => {
  assert.deepEqual(SANCTION_ORDER, [
    "CAUTION",
    "WARNING",
    "GAME LOSS",
    "DISQUALIFICATION",
    "DISQUALIFICATION WITHOUT PRIZE",
  ]);
});

test("judgesGuideUrl builds a Text Fragment URL for known rules", () => {
  const url = judgesGuideUrl(131);
  assert.ok(url.startsWith(JUDGES_GUIDE_URL + "#:~:text="), `unexpected url: ${url}`);
  // The encoded fragment must contain the rule number with its dot separator
  assert.ok(url.includes("131."));
  assert.ok(url.includes("Marked%20Cards"));
});

test("judgesGuideUrl returns null for unknown rule numbers", () => {
  assert.equal(judgesGuideUrl(999), null);
  assert.equal(judgesGuideUrl(0), null);
});

test("parseReference handles empty / placeholder cells", () => {
  assert.deepEqual(parseReference(""), []);
  assert.deepEqual(parseReference("///"), []);
  assert.deepEqual(parseReference(null), []);
  assert.deepEqual(parseReference(undefined), []);
  assert.deepEqual(parseReference("   "), []);
});

test("parseReference parses a single rule number", () => {
  const out = parseReference("131");
  assert.equal(out.length, 1);
  assert.equal(out[0].number, 131);
  assert.ok(out[0].url.includes("131."));
  assert.ok(out[0].title.startsWith("131."));
});

test("parseReference parses a range like '141 - 162' as two anchor numbers", () => {
  const out = parseReference("141 - 162");
  assert.equal(out.length, 2);
  assert.equal(out[0].number, 141);
  assert.equal(out[1].number, 162);
  assert.ok(out[0].url.includes("Slow%20Play"));
  assert.ok(out[1].url.includes("Stalling"));
});

test("parseReference returns null url for unknown numbers", () => {
  const out = parseReference("999");
  assert.equal(out.length, 1);
  assert.equal(out[0].number, 999);
  assert.equal(out[0].url, null);
  assert.equal(out[0].title, null);
});
