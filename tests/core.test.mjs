import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SANCTION_ORDER,
  JUDGES_GUIDE_URL,
  JUDGES_GUIDE_RULES,
  JUDGES_GUIDE_RULE_TEXTS,
  norm,
  escapeHtml,
  extractMentionedRules,
  highlightHtml,
  highlightProse,
  itemSlug,
  matchSearch,
  computeFiltered,
  groupByCategory,
  judgesGuideUrl,
  parseReference,
  parseSanction,
  renderRuleHtml,
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
  assert.ok(out.every((e) => /buste/i.test(e.infraction ?? "")));
  // No match returns empty.
  assert.equal(computeFiltered(sample, "nonesistente").length, 0);
});

test("groupByCategory preserves insertion order and groups items", () => {
  const groups = groupByCategory(sample);
  const keys = [...groups.keys()];
  assert.deepEqual(keys, ["DECK", "CONDOTTA IMPROPRIA"]);
  const deck = groups.get("DECK");
  const condotta = groups.get("CONDOTTA IMPROPRIA");
  assert.ok(deck && condotta);
  assert.equal(deck.length, 2);
  assert.equal(condotta.length, 2);
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
  assert.ok(url, "expected non-null URL for known rule");
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
  const r = out[0];
  assert.ok(r && r.url && r.title);
  assert.equal(r.number, 131);
  assert.ok(r.url.includes("131."));
  assert.ok(r.title.startsWith("131."));
});

test("parseReference parses a range like '141 - 162' as two anchor numbers", () => {
  const out = parseReference("141 - 162");
  assert.equal(out.length, 2);
  const [a, b] = out;
  assert.ok(a && b && a.url && b.url);
  assert.equal(a.number, 141);
  assert.equal(b.number, 162);
  assert.ok(a.url.includes("Slow%20Play"));
  assert.ok(b.url.includes("Stalling"));
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

test("parseSanction expands multi-sanction range to all intermediate steps", () => {
  // Two-endpoint form is shorthand for a severity range: the parser
  // expands it so the judge sees every intermediate sanction (not just
  // the bookends) as a possible outcome.
  const out = parseSanction("CAUTION - GAME LOSS");
  assert.equal(out.kind, "multi");
  assert.deepEqual(out.sanctions, ["CAUTION", "WARNING", "GAME LOSS"]);

  const range = parseSanction("GAME LOSS - DISQUALIFICATION WITHOUT PRIZE");
  assert.deepEqual(range.sanctions, ["GAME LOSS", "DISQUALIFICATION", "DISQUALIFICATION WITHOUT PRIZE"]);

  const adjacent = parseSanction("CAUTION - WARNING");
  assert.deepEqual(adjacent.sanctions, ["CAUTION", "WARNING"]);
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
  // Whitespace-tolerant parsing still expands the range.
  assert.deepEqual(out.sanctions, ["CAUTION", "WARNING", "GAME LOSS"]);
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

test("highlightHtml: long query that is a substring of a longer phrase", () => {
  // Real-world case: searching "DISQUALIFICATION" against a heading like
  // "DISQUALIFICATION WITHOUT PRIZE" must mark the full query once, not
  // overlap or skip the trailing token.
  assert.equal(
    highlightHtml("DISQUALIFICATION WITHOUT PRIZE", "DISQUALIFICATION"),
    "<mark>DISQUALIFICATION</mark> WITHOUT PRIZE",
  );
});

test("highlightHtml: overlapping candidate matches collapse to non-overlapping spans", () => {
  // "aaa" inside "aaaaa" could theoretically produce 3 overlapping hits;
  // findNormalisedRanges advances past each match so we get 1 non-overlapping
  // hit covering positions 0-2 and the trailing "aa" stays plain.
  assert.equal(highlightHtml("aaaaa", "aaa"), "<mark>aaa</mark>aa");
});

test("highlightHtml: accent-folded long query spanning multiple words", () => {
  // Diacritic-folded query must match across a phrase boundary without
  // duplicating <mark> or splitting on the space.
  assert.equal(highlightHtml("perché ora più tardi", "perche ora piu"), "<mark>perché ora più</mark> tardi");
});

test("highlightHtml: query longer than source returns escaped source", () => {
  assert.equal(highlightHtml("brief", "much longer query"), "brief");
});

test("extractMentionedRules collects in-prose rule numbers, dedup vs reference", () => {
  const item = {
    category: "Deck",
    infraction: "Buste segnate (con schema)",
    reference: "132",
    sanction: "GAME LOSS",
    description: "Schema riconoscibile dal retro. Vedi 163. Cheating - Fraud.",
    example: "Tutte le master segnate; cripta distinguibile.",
    philosophy: "VEKN 132 base; se intenzionale → 163.",
    correzione: "Sostituire le buste; in caso di intent applicare 163.",
  };
  const out = extractMentionedRules(item);
  // 132 is the canonical reference → not duplicated; 163 is mentioned in
  // multiple fields → returned once.
  assert.deepEqual(
    out.map((r) => r.number),
    [163],
  );
  const r = out[0];
  assert.ok(r && r.url);
  assert.ok(r.url.includes("163."));
});

test("extractMentionedRules ignores numbers not in the rules map", () => {
  const item = {
    category: "X",
    infraction: "Y",
    reference: "",
    sanction: "",
    description: "Una mano da 7 carte; cripta da 12; libreria 90.",
    example: "",
    philosophy: "",
    correzione: "",
  };
  // 7, 12, 90 are not 3-digit; nothing matches the map.
  assert.deepEqual(extractMentionedRules(item), []);
});

test("extractMentionedRules handles null/missing fields without throwing", () => {
  assert.deepEqual(extractMentionedRules(null), []);
  assert.deepEqual(extractMentionedRules(undefined), []);
  assert.deepEqual(extractMentionedRules({}), []);
});

test("highlightProse linkifies known rule numbers in prose", () => {
  const out = highlightProse("Vedi 163. Cheating per dettagli.", "");
  // Inline citations are <button data-rule="N"> so they trigger the
  // local modal instead of attempting an external Text Fragment scroll.
  assert.match(out, /<button[^>]*class="rule-mention"[^>]*data-rule="163"[^>]*>163<\/button>/);
  assert.ok(out.includes("Vedi "));
  assert.ok(out.includes(". Cheating per dettagli."));
});

test("highlightProse leaves non-rule numbers as plain text", () => {
  const out = highlightProse("Mano 7, libreria 90, anno 2026.", "");
  assert.equal(out, "Mano 7, libreria 90, anno 2026.");
});

test("highlightProse marks query AND linkifies rule on overlap", () => {
  // Query "163" overlaps the rule citation: both decorations apply.
  const out = highlightProse("Regola 163 nel testo.", "163");
  assert.match(out, /<button[^>]*class="rule-mention"[^>]*data-rule="163"[^>]*>(<mark>163<\/mark>|163)<\/button>/);
  assert.ok(out.includes("<mark>"), "mark should appear somewhere");
});

test("highlightProse escapes HTML and still linkifies", () => {
  const out = highlightProse("<script> 163 </script>", "");
  assert.ok(out.startsWith("&lt;script&gt;"));
  assert.match(out, /<button[^>]*class="rule-mention"[^>]*data-rule="163"[^>]*>163<\/button>/);
});

test("highlightProse handles empty / null inputs", () => {
  assert.equal(highlightProse("", "anything"), "");
  assert.equal(highlightProse(null, "x"), "");
  assert.equal(highlightProse(undefined, "x"), "");
});

test("JUDGES_GUIDE_RULE_TEXTS covers every rule in JUDGES_GUIDE_RULES", () => {
  // The chip/inline UI relies on the local modal for every actionable
  // rule; if a rule is in the index map but missing a verbatim text,
  // the chip would render as a dead button. Catch that gap at CI time.
  for (const k of Object.keys(JUDGES_GUIDE_RULES)) {
    const n = Number(k);
    const rule = JUDGES_GUIDE_RULE_TEXTS[n];
    assert.ok(rule, `missing rule text for ${k}`);
    assert.ok(rule.heading.startsWith(`${k}.`), `heading for ${k} must start with "${k}."`);
    assert.ok(rule.intro, `rule ${k} must have an intro`);
    assert.ok(rule.penalty, `rule ${k} must have a penalty`);
  }
});

test("renderRuleHtml emits structured sections for a known rule", () => {
  const out = renderRuleHtml(131);
  assert.ok(out, "should return non-null for a known rule");
  assert.match(out, /<section class="rule-section rule-section-intro">/);
  assert.match(out, /<section class="rule-section rule-section-penalty"><h3>Penalty<\/h3>/);
  assert.match(out, /<strong>Caution<\/strong>/, "**Caution** must be promoted to <strong>");
});

test("renderRuleHtml emits an examples list when provided", () => {
  const out = renderRuleHtml(131);
  assert.ok(out);
  assert.match(out, /<section class="rule-section rule-section-examples"><h3>Examples<\/h3><ul><li>/);
});

test("renderRuleHtml renders bullet lines as <ul>", () => {
  const out = renderRuleHtml(101);
  assert.ok(out);
  assert.match(out, /<ul><li>The decklist contains an illegal number of cards\.<\/li>/);
});

test("renderRuleHtml escapes HTML in source text", () => {
  // The rule data is plain text but we still defend against future edits
  // that might accidentally include raw HTML (or malicious paste).
  const out = renderRuleHtml(122);
  assert.ok(out && !out.includes("<script>"), "must not pass through raw <script>");
});

test("renderRuleHtml returns null for an unknown rule number", () => {
  assert.equal(renderRuleHtml(999), null);
  assert.equal(renderRuleHtml(0), null);
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
