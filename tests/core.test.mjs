import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SANCTION_ORDER,
  JUDGES_GUIDE_URL,
  JUDGES_GUIDE_RULES,
  norm,
  escapeHtml,
  highlightHtml,
  itemSlug,
  matchSearch,
  computeFiltered,
  groupByCategory,
  judgesGuideUrl,
  parseReference,
  parseSanction,
  validateEntry,
  validateData,
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
  {
    category: "DECK",
    infraction: "BUSTE SEGNATE",
    reference: "131",
    sanction: "CAUTION",
    description: "",
    example: "",
    philosophy: "",
    correzione: "sostituire",
  },
  {
    category: "DECK",
    infraction: "BUSTE SEGNATE CON SCHEMA",
    reference: "132",
    sanction: "GAME LOSS",
    description: "",
    example: "",
    philosophy: "",
    correzione: "",
  },
  {
    category: "CONDOTTA IMPROPRIA",
    infraction: "BARARE",
    reference: "163",
    sanction: "DISQUALIFICATION WITHOUT PRIZE",
    description: "alterazione",
    example: "aggiungere pool",
    philosophy: "",
    correzione: "",
  },
  {
    category: "CONDOTTA IMPROPRIA",
    infraction: "AIUTO ESTERNO",
    reference: "",
    sanction: "???",
    description: "",
    example: "",
    philosophy: "",
    correzione: "",
  },
];

test("matchSearch is empty-query permissive", () => {
  assert.equal(matchSearch(sample[0], ""), true);
  assert.equal(matchSearch(sample[0], "   "), true);
});

test("matchSearch matches across infraction, correzione, reference, category", () => {
  assert.equal(matchSearch(sample[0], "buste"), true);
  assert.equal(matchSearch(sample[0], "131"), true);
  assert.equal(matchSearch(sample[0], "deck"), true);
  assert.equal(matchSearch(sample[0], "sostituire"), true);
  assert.equal(matchSearch(sample[0], "nonesistente"), false);
});

test("matchSearch matches description, example and correzione fields", () => {
  assert.equal(matchSearch(sample[2], "alterazione"), true); // description
  assert.equal(matchSearch(sample[2], "aggiungere"), true); // example
  assert.equal(matchSearch(sample[0], "sostituire"), true); // correzione
});

test("computeFiltered narrows by search query, full set when query empty", () => {
  // Empty query returns all items.
  assert.equal(computeFiltered(sample, "").length, sample.length);
  // Substring narrows the result.
  const out = computeFiltered(sample, "buste");
  assert.equal(out.length, 2);
  assert.ok(out.every((e) => /buste/i.test(e.infraction)));
  // No match returns empty.
  assert.equal(computeFiltered(sample, "nonesistente").length, 0);
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

test("JUDGES_GUIDE_RULES has unique numeric keys and well-formed titles", () => {
  // Catches accidental copy-paste duplicates that would silently break
  // deep-links to the VEKN Judges' Guide. The map is hand-maintained,
  // so a CI-level uniqueness check is cheaper than a post-mortem.
  const entries = Object.entries(JUDGES_GUIDE_RULES);
  assert.ok(entries.length > 0, "rules map must not be empty");
  const numbers = entries.map(([k]) => Number(k));
  for (const n of numbers) {
    assert.ok(Number.isInteger(n) && n > 0, `rule key ${n} must be a positive integer`);
  }
  // Sets de-duplicate by definition; comparing sizes flags a duplicate key
  // even though Object.entries would have already collapsed plain duplicates.
  assert.equal(new Set(numbers).size, numbers.length, "duplicate rule numbers detected");
  // Each title must start with the same number followed by ". " so the
  // Text Fragment URL anchors against a unique heading.
  for (const [k, title] of entries) {
    assert.ok(typeof title === "string" && title.length > 0, `title for ${k} must be non-empty`);
    assert.ok(title.startsWith(`${k}.`), `title for ${k} must start with "${k}."; got ${JSON.stringify(title)}`);
  }
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

test("parseSanction recognises canonical single sanctions", () => {
  const out = parseSanction("CAUTION");
  assert.equal(out.kind, "single");
  assert.deepEqual(out.sanctions, ["CAUTION"]);
  assert.equal(out.description, "");
});

test("parseSanction parses multi-sanction with ' - ' separator", () => {
  const out = parseSanction("CAUTION - GAME LOSS");
  assert.equal(out.kind, "multi");
  assert.deepEqual(out.sanctions, ["CAUTION", "GAME LOSS"]);
});

test("parseSanction maps placeholders to localised descriptions", () => {
  assert.equal(parseSanction("///").description, "Nessuna");
  assert.equal(parseSanction("???").description, "Da definire");
  assert.equal(parseSanction("").description, "Da definire");
  for (const v of ["///", "???", ""]) {
    assert.equal(parseSanction(v).kind, "placeholder");
    assert.deepEqual(parseSanction(v).sanctions, []);
  }
});

test("parseSanction surfaces unknown values as placeholder description", () => {
  const out = parseSanction("MAGIC");
  assert.equal(out.kind, "placeholder");
  assert.equal(out.description, "MAGIC");
  assert.deepEqual(out.sanctions, []);
});

test("parseSanction tolerates whitespace around the separator", () => {
  const out = parseSanction("CAUTION  -  GAME LOSS");
  assert.equal(out.kind, "multi");
  assert.deepEqual(out.sanctions, ["CAUTION", "GAME LOSS"]);
});

test("highlightHtml escapes plain text when query is empty", () => {
  assert.equal(highlightHtml("<b>x</b>", ""), "&lt;b&gt;x&lt;/b&gt;");
  assert.equal(highlightHtml("a & b", null), "a &amp; b");
});

test("highlightHtml wraps matches in <mark> and escapes the rest", () => {
  assert.equal(highlightHtml("Slow play", "play"), "Slow <mark>play</mark>");
  assert.equal(highlightHtml("a & b", "&"), "a <mark>&amp;</mark> b");
});

test("highlightHtml matches accent- and case-insensitively", () => {
  // search "perche" should highlight "perché" preserving original glyph
  assert.equal(highlightHtml("perché ora", "perche"), "<mark>perché</mark> ora");
  assert.equal(highlightHtml("PIÙ tempo", "piu"), "<mark>PIÙ</mark> tempo");
});

test("highlightHtml handles multiple, non-overlapping matches", () => {
  assert.equal(highlightHtml("più o meno più", "più"), "<mark>più</mark> o meno <mark>più</mark>");
});

test("highlightHtml returns escaped text when no match", () => {
  assert.equal(highlightHtml("ciao <mondo>", "xyz"), "ciao &lt;mondo&gt;");
});

test("validateEntry accepts a canonical entry", () => {
  const r = validateEntry({
    category: "Deck",
    infraction: "Buste segnate",
    reference: "131",
    sanction: "CAUTION",
    description: "ok",
    example: "una sleeve graffiata",
    philosophy: "",
    correzione: "",
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test("validateEntry rejects non-objects", () => {
  for (const v of [null, undefined, "x", 1, [], true]) {
    const r = validateEntry(v);
    assert.equal(r.ok, false);
    assert.ok(r.errors.length > 0);
  }
});

test("validateEntry flags missing, extra and non-string fields", () => {
  const r = validateEntry({ category: "X", infraction: "Y", reference: "131", sanction: "CAUTION" });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("description")));
  assert.ok(r.errors.some((e) => e.includes("example")));
  assert.ok(r.errors.some((e) => e.includes("correzione")));

  const r2 = validateEntry({
    category: "X",
    infraction: "Y",
    reference: "131",
    sanction: "CAUTION",
    description: "",
    example: "",
    philosophy: "",
    correzione: "",
    notes: "extra",
  });
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("unknown field: notes")));

  const r3 = validateEntry({
    category: "X",
    infraction: "Y",
    reference: "131",
    sanction: "CAUTION",
    description: 42,
    example: "",
    philosophy: "",
    correzione: "",
  });
  assert.equal(r3.ok, false);
  assert.ok(r3.errors.some((e) => e.includes('"description"') && e.includes("not a string")));
});

test("validateEntry rejects empty category or infraction", () => {
  const r = validateEntry({
    category: "",
    infraction: "",
    reference: "",
    sanction: "",
    description: "",
    example: "",
    philosophy: "",
    correzione: "",
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("category is empty")));
  assert.ok(r.errors.some((e) => e.includes("infraction is empty")));
});

test("validateEntry rejects malformed reference and unknown sanction", () => {
  const r = validateEntry({
    category: "X",
    infraction: "Y",
    reference: "foo",
    sanction: "MEGA LOSS",
    description: "",
    example: "",
    philosophy: "",
    correzione: "",
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("reference")));
  assert.ok(r.errors.some((e) => e.includes("sanction")));
});

test("validateEntry accepts canonical placeholder and range forms", () => {
  for (const ref of ["", "///", "131", "141 - 162", "141  -  162"]) {
    const r = validateEntry({
      category: "X",
      infraction: "Y",
      reference: ref,
      sanction: "",
      description: "",
      example: "",
      philosophy: "",
      correzione: "",
    });
    assert.equal(r.ok, true, `ref ${JSON.stringify(ref)} should pass: ${r.errors.join(", ")}`);
  }
  for (const s of ["", "???", "///", "CAUTION", "CAUTION - GAME LOSS", "DISQUALIFICATION WITHOUT PRIZE"]) {
    const r = validateEntry({
      category: "X",
      infraction: "Y",
      reference: "",
      sanction: s,
      description: "",
      example: "",
      philosophy: "",
      correzione: "",
    });
    assert.equal(r.ok, true, `sanction ${JSON.stringify(s)} should pass: ${r.errors.join(", ")}`);
  }
});

test("validateData splits valid entries from issues without throwing", () => {
  const { entries, issues } = validateData([
    {
      category: "A",
      infraction: "B",
      reference: "",
      sanction: "",
      description: "",
      example: "",
      philosophy: "",
      correzione: "",
    },
    {
      category: "",
      infraction: "",
      reference: "x",
      sanction: "",
      description: "",
      example: "",
      philosophy: "",
      correzione: "",
    },
    "not an object",
  ]);
  assert.equal(entries.length, 1);
  assert.equal(issues.length, 2);
  assert.deepEqual(
    issues.map((i) => i.index),
    [1, 2],
  );
});

test("validateData rejects a non-array payload", () => {
  const r = validateData({ items: [] });
  assert.equal(r.entries.length, 0);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].index, -1);
});

test("itemSlug derives a stable url-safe identifier", () => {
  const a = itemSlug({ category: "Condotta impropria", infraction: "Slow play" });
  assert.equal(a, "condotta-impropria-slow-play");
  // Apostrophes, accents and punctuation collapse to single dashes
  const b = itemSlug({ category: "Errori utilizzo carte", infraction: "Errore nell'utilizzo dell'effetto" });
  assert.equal(b, "errori-utilizzo-carte-errore-nell-utilizzo-dell-effetto");
  // Empty-ish input falls back to a non-empty slug
  assert.equal(itemSlug({}), "item");
});
