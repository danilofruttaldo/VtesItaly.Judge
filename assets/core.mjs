/* Pure, DOM-free helpers for tests (node --test) and runtime use.
 * Mutation happens in app.js; everything here is a plain transformation.
 */

export const SANCTION_ORDER = ["CAUTION", "WARNING", "GAME LOSS", "DISQUALIFICATION", "DISQUALIFICATION WITHOUT PRIZE"];

const SANCTION_SET = new Set(SANCTION_ORDER);

/* Display labels: short, sentence-case, optimized for narrow phone badges. */
export const SANCTION_LABELS = {
  CAUTION: "Caution",
  WARNING: "Warning",
  "GAME LOSS": "Game loss",
  DISQUALIFICATION: "Disqualification",
  "DISQUALIFICATION WITHOUT PRIZE": "DQ senza premio",
};

/* CSS custom-property names for each canonical sanction. Used to drive the
 * left-edge color (and the gradient when multi). Kept here so the data layer
 * decides which color goes where, not the markup. */
export const SANCTION_VARS = {
  CAUTION: "--s-caution",
  WARNING: "--s-warning",
  "GAME LOSS": "--s-gameloss",
  DISQUALIFICATION: "--s-dq",
  "DISQUALIFICATION WITHOUT PRIZE": "--s-dqnp",
};

/* Short, lowercase tokens for each sanction. Used as `data-s1`/`data-s2`
 * attribute values on cards so the CSS layer can map them to colors via
 * static attribute selectors — no inline `style=` needed, which keeps the
 * Content Security Policy strict (no `'unsafe-inline'` style required). */
export const SANCTION_SLUGS = {
  CAUTION: "caution",
  WARNING: "warning",
  "GAME LOSS": "game-loss",
  DISQUALIFICATION: "dq",
  "DISQUALIFICATION WITHOUT PRIZE": "dqnp",
};

/* Italian descriptions for entries where the sanction field is empty or
 * a placeholder. The data uses "///" for cases that have no formal VEKN
 * sanction (legitimate deals, missed optional actions) — those render as
 * a muted "Nessuna" badge. "???" is reserved for entries the editorial
 * board hasn't decided yet. */
/** @type {Record<string, string>} */
export const SANCTION_FALLBACKS = {
  "": "Da definire",
  "///": "Nessuna",
  "???": "Da definire",
};

/**
 * @typedef {{ kind: "single" | "multi" | "placeholder", sanctions: string[], description: string, raw: string }} ParsedSanction
 */

/**
 * Parses the raw SANZIONE cell into a structured form so the rendering layer
 * can decide colors, badges, and filter membership without re-parsing.
 *
 * Multi-sanction cells use " - " as separator (e.g. "CAUTION - GAME LOSS"
 * for slow play, where the severity depends on intent). Both endpoints must
 * be canonical; otherwise the cell is treated as a placeholder.
 *
 * @param {string | null | undefined} raw
 * @returns {ParsedSanction}
 */
export function parseSanction(raw) {
  const t = (raw || "").trim();
  if (Object.prototype.hasOwnProperty.call(SANCTION_FALLBACKS, t)) {
    return { kind: "placeholder", sanctions: [], description: SANCTION_FALLBACKS[t], raw: t };
  }
  if (SANCTION_SET.has(t)) {
    return { kind: "single", sanctions: [t], description: "", raw: t };
  }
  const parts = t
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => SANCTION_SET.has(p))) {
    // Two-endpoint form ("CAUTION - GAME LOSS") is shorthand for a severity
    // range. Expand it to include every intermediate sanction so the judge
    // sees the full gradient (CAUTION → WARNING → GAME LOSS) instead of
    // just the bookends — the middle outcomes are equally valid rulings.
    const startIdx = SANCTION_ORDER.indexOf(parts[0]);
    const endIdx = SANCTION_ORDER.indexOf(parts[parts.length - 1]);
    if (startIdx >= 0 && endIdx >= 0 && startIdx !== endIdx) {
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      const expanded = SANCTION_ORDER.slice(lo, hi + 1);
      const sanctions = startIdx <= endIdx ? expanded : expanded.slice().reverse();
      return { kind: "multi", sanctions, description: "", raw: t };
    }
    return { kind: "multi", sanctions: parts, description: "", raw: t };
  }
  // Unknown / non-canonical: surface the raw value as the description so the
  // user still sees what was authored, instead of silently hiding it.
  return { kind: "placeholder", sanctions: [], description: t || "Da definire", raw: t };
}

export const JUDGES_GUIDE_URL = "https://www.vekn.net/judges-guide";

/* Map of penalty rule numbers to the exact heading text on the Judges' Guide
 * page. The page has no id/name anchors, so we deep-link via Text Fragments
 * (`#:~:text=...`), supported in Chromium/Safari and falling back to the top
 * of the page on Firefox. Headings start with "NNN. Title", which is unique
 * enough that the trailing-dot form already disambiguates from in-text
 * mentions. The full title is used here for robust matching and as the link's
 * accessible name. Source verified against the live Judges' Guide HTML.
 */
export const JUDGES_GUIDE_RULES = {
  101: "101. Deck Problem - Illegal Decklist",
  102: "102. Deck Problem - Illegal Main Deck (Legal Decklist)",
  103: "103. Deck Problem - Illegal Main Deck (No Decklist Used)",
  111: "111. Procedural Error - Minor",
  112: "112. Procedural Error - Major",
  113: "113. Procedural Error - Severe",
  114: "114. Procedural Error - Misrepresentation",
  121: "121. Card Drawing - Drawing Extra Cards",
  122: "122. Card Drawing - Looking at Extra Cards",
  123: "123. Card Drawing - Improper Drawing at Start of Game",
  124: "124. Card Drawing - Failure to Draw",
  131: "131. Marked Cards - No Pattern",
  132: "132. Marked Cards - Observable Pattern",
  141: "141. Slow Play - Playing Slowly",
  142: "142. Slow Play - Exceeding Pre-Game Time Limit",
  151: "151. Unsportsmanlike Conduct - Minor",
  152: "152. Unsportsmanlike Conduct - Major",
  153: "153. Unsportsmanlike Conduct - Severe",
  161: "161. Cheating - Bribery",
  162: "162. Cheating - Stalling",
  163: "163. Cheating - Fraud",
  164: "164. Cheating - Collusion",
};

/**
 * Builds a deep-link to a specific rule on the Judges' Guide using the Text
 * Fragments URL extension. Returns null when the number isn't in the map so
 * callers can render plain text instead of a broken link.
 * @param {number} ruleNumber
 * @returns {string | null}
 */
export function judgesGuideUrl(ruleNumber) {
  const title = JUDGES_GUIDE_RULES[ruleNumber];
  if (!title) return null;
  return `${JUDGES_GUIDE_URL}#:~:text=${encodeURIComponent(title)}`;
}

/**
 * @typedef {{ number: number, title: string | null, url: string | null }} ReferenceLink
 */

/**
 * Parses a CSV "RIFERIMENTI" cell into one or more rule links.
 *
 * The cell contains either:
 *   - "" or "///" → no reference
 *   - a single number (e.g. "131")
 *   - a range "N1 - N2" (e.g. "141 - 162") which maps to TWO separate links:
 *     the start and end numbers. We don't expand the range because the rules
 *     between them aren't always relevant (the CSV uses the range as a "see
 *     these two rules" shorthand, not "every rule in between").
 *
 * The url is null when the number is unknown — callers should fall back to
 * plain text in that case to avoid linking into thin air.
 *
 * @param {string | null | undefined} ref
 * @returns {ReferenceLink[]}
 */
export function parseReference(ref) {
  if (!ref) return [];
  const trimmed = String(ref).trim();
  if (!trimmed || trimmed === "///") return [];
  const parts = trimmed.split(/\s*-\s*/).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (!Number.isFinite(n)) continue;
    out.push({
      number: n,
      title: JUDGES_GUIDE_RULES[n] || null,
      url: judgesGuideUrl(n),
    });
  }
  return out;
}

/**
 * Scans an entry's prose fields (description, example, philosophy,
 * correzione) for VEKN rule numbers that exist in JUDGES_GUIDE_RULES,
 * deduplicating against the canonical `reference` cell. Used to surface
 * every applicable rule as a clickable chip so the judge doesn't have to
 * re-read the prose to find an inline "VEKN 102" or "163. Cheating".
 *
 * Matches 3-digit standalone tokens and filters them through the rules
 * map — non-rule numbers (counts, years) are dropped because they don't
 * collide with the 101–164 keyspace.
 *
 * @param {VademecumEntry | null | undefined} item
 * @returns {ReferenceLink[]}
 */
export function extractMentionedRules(item) {
  if (!item) return [];
  const primary = new Set(parseReference(item.reference).map((p) => p.number));
  /** @type {Set<number>} */
  const found = new Set();
  const fields = [item.description, item.example, item.philosophy, item.correzione];
  for (const field of fields) {
    if (!field) continue;
    const matches = String(field).matchAll(/\b(\d{3})\b/g);
    for (const m of matches) {
      const n = parseInt(m[1], 10);
      if (!Number.isFinite(n)) continue;
      if (!Object.prototype.hasOwnProperty.call(JUDGES_GUIDE_RULES, n)) continue;
      if (primary.has(n)) continue;
      found.add(n);
    }
  }
  return [...found]
    .sort((a, b) => a - b)
    .map((n) => ({ number: n, title: JUDGES_GUIDE_RULES[n], url: judgesGuideUrl(n) }));
}

/**
 * Normalises a string for diacritic- and case-insensitive comparison: NFD
 * decomposition, combining-mark stripping, lowercase, trim. The output is
 * suitable for substring search but not for display.
 * @param {string | null | undefined} s
 * @returns {string}
 */
export function norm(s) {
  if (s === null || s === undefined) return "";
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** @type {Record<string, string>} */
const HTML_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * @param {string | null | undefined} s
 * @returns {string}
 */
export function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

/**
 * HTML-escapes `text` and wraps query matches in <mark>. The match is
 * accent- and case-insensitive (same equivalence class as norm()), so a
 * search for "perche" highlights "perché" in the source. Matches are
 * non-overlapping and rendered in the order they appear. Returns plain
 * escaped HTML when query is empty or has no hit.
 * @param {string | null | undefined} text
 * @param {string | null | undefined} query
 * @returns {string}
 */
export function highlightHtml(text, query) {
  const src = text === null || text === undefined ? "" : String(text);
  const qn = norm(query);
  if (!src || !qn) return escapeHtml(src);

  // Build a normalized projection of `src` and a parallel index map so we
  // can search in the normalized space and emit slices of the original.
  let projected = "";
  const map = []; // map[i] = source index that produced projected[i]
  for (let i = 0; i < src.length; i++) {
    const piece = src[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const c of piece) {
      projected += c;
      map.push(i);
    }
  }

  const ranges = [];
  let from = 0;
  while (from <= projected.length - qn.length) {
    const idx = projected.indexOf(qn, from);
    if (idx < 0) break;
    const start = map[idx];
    const endProjected = idx + qn.length - 1;
    const endSrc = (map[endProjected] ?? src.length - 1) + 1;
    ranges.push([start, endSrc]);
    from = endProjected + 1;
  }
  if (ranges.length === 0) return escapeHtml(src);

  let out = "";
  let cursor = 0;
  for (const [s, e] of ranges) {
    if (s < cursor) continue;
    out += escapeHtml(src.slice(cursor, s));
    out += `<mark>${escapeHtml(src.slice(s, e))}</mark>`;
    cursor = e;
  }
  out += escapeHtml(src.slice(cursor));
  return out;
}

/**
 * Renders prose text with both query-highlight (<mark>) decoration and
 * inline rule-number linkification: any 3-digit token that maps to a
 * known JUDGES_GUIDE_RULES entry becomes a clickable deep-link to the
 * Judges' Guide, while the search query (if any) is wrapped in <mark>.
 *
 * Both decorations can overlap on the same range (e.g. searching "163"
 * inside a citation): we split the source at every boundary and emit
 * each segment with whichever decorations fully cover it. Adjacent
 * <mark>s on different segments are valid HTML and render correctly,
 * even if the visual highlight has a tiny break at the link boundary.
 *
 * @param {string | null | undefined} text
 * @param {string | null | undefined} query
 * @returns {string}
 */
export function highlightProse(text, query) {
  const src = text === null || text === undefined ? "" : String(text);
  if (!src) return "";

  /** @type {{ start: number, end: number, number: number }[]} */
  const ruleAnns = [];
  for (const m of src.matchAll(/\b(\d{3})\b/g)) {
    const n = parseInt(m[1], 10);
    if (Object.prototype.hasOwnProperty.call(JUDGES_GUIDE_RULES, n)) {
      ruleAnns.push({
        start: /** @type {number} */ (m.index),
        end: /** @type {number} */ (m.index) + m[0].length,
        number: n,
      });
    }
  }

  const qn = norm(query);
  /** @type {{ start: number, end: number }[]} */
  const markAnns = [];
  if (qn) {
    let projected = "";
    /** @type {number[]} */
    const map = [];
    for (let i = 0; i < src.length; i++) {
      const piece = src[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      for (const c of piece) {
        projected += c;
        map.push(i);
      }
    }
    let from = 0;
    while (from <= projected.length - qn.length) {
      const idx = projected.indexOf(qn, from);
      if (idx < 0) break;
      const start = map[idx];
      const endProj = idx + qn.length - 1;
      const end = (map[endProj] ?? src.length - 1) + 1;
      markAnns.push({ start, end });
      from = endProj + 1;
    }
  }

  if (ruleAnns.length === 0 && markAnns.length === 0) return escapeHtml(src);

  /** @type {Set<number>} */
  const boundaries = new Set([0, src.length]);
  for (const a of ruleAnns) {
    boundaries.add(a.start);
    boundaries.add(a.end);
  }
  for (const a of markAnns) {
    boundaries.add(a.start);
    boundaries.add(a.end);
  }
  const sorted = [...boundaries].sort((a, b) => a - b);

  let out = "";
  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i];
    const segEnd = sorted[i + 1];
    const ruleHere = ruleAnns.find((a) => a.start <= segStart && a.end >= segEnd);
    const markHere = markAnns.find((a) => a.start <= segStart && a.end >= segEnd);
    let chunk = escapeHtml(src.slice(segStart, segEnd));
    if (markHere) chunk = `<mark>${chunk}</mark>`;
    if (ruleHere) {
      const url = judgesGuideUrl(ruleHere.number);
      const title = JUDGES_GUIDE_RULES[ruleHere.number];
      chunk = `<a class="rule-mention" href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank" title="${escapeHtml(title)}">${chunk}</a>`;
    }
    out += chunk;
  }
  return out;
}

/**
 * @typedef {{ category?: string, infraction?: string, reference?: string, sanction?: string, description?: string, example?: string, philosophy?: string, correzione?: string }} VademecumEntry
 */

/**
 * Stable, URL-safe slug for an item, derived from category + infraction.
 * Used as the DOM id of each card so that location.hash can deep-link to
 * a specific entry (e.g. share "#item-condotta-impropria-slow-play"). The
 * slug is intentionally derived (not authored) so judges don't need to
 * maintain ids in vademecum.json. Collisions are unlikely — category +
 * infraction is unique by editorial convention (enforced by data.test.mjs).
 * @param {VademecumEntry} item
 * @returns {string}
 */
export function itemSlug(item) {
  const base = `${item.category || ""} ${item.infraction || ""}`;
  return (
    norm(base)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

/**
 * Returns true when the item matches the search query against any of the
 * searchable text fields. Empty query matches everything.
 * @param {VademecumEntry} item
 * @param {string | null | undefined} query
 * @returns {boolean}
 */
export function matchSearch(item, query) {
  const q = norm(query);
  if (!q) return true;
  const hay = [
    item.category,
    item.infraction,
    item.reference,
    item.sanction,
    item.description,
    item.example,
    item.philosophy,
    item.correzione,
  ]
    .map(norm)
    .join(" \n ");
  return hay.includes(q);
}

/**
 * @param {VademecumEntry[]} items
 * @param {string | null | undefined} query
 * @returns {VademecumEntry[]}
 */
export function computeFiltered(items, query) {
  return items.filter((it) => matchSearch(it, query));
}

/**
 * @param {VademecumEntry[]} items
 * @returns {Map<string, VademecumEntry[]>}
 */
export function groupByCategory(items) {
  /** @type {Map<string, VademecumEntry[]>} */
  const groups = new Map();
  for (const it of items) {
    const k = it.category || "—";
    if (!groups.has(k)) groups.set(k, []);
    /** @type {VademecumEntry[]} */ (groups.get(k)).push(it);
  }
  return groups;
}

/* Schema for a single vademecum entry. Mirrors data/vademecum.schema.json
 * and is used both at build-time (tests/data.test.mjs gates CI) and at
 * runtime (app.js filters malformed entries so a single bad row can't
 * crash the page). Keep the two in sync.
 *
 * Required fields: category, infraction, reference, sanction, description,
 * example, philosophy, correzione. Only category and infraction must be
 * non-empty; the rest may be empty strings, but they MUST be present as strings.
 */
const REFERENCE_RE = /^(|\/\/\/|\d+|\d+\s*-\s*\d+)$/;
const SANCTION_VALUES = new Set([
  "",
  "???",
  "///",
  ...SANCTION_ORDER,
  "CAUTION - WARNING",
  "CAUTION - GAME LOSS",
  "CAUTION - DISQUALIFICATION",
  "CAUTION - DISQUALIFICATION WITHOUT PRIZE",
  "WARNING - GAME LOSS",
  "WARNING - DISQUALIFICATION",
  "WARNING - DISQUALIFICATION WITHOUT PRIZE",
  "GAME LOSS - DISQUALIFICATION",
  "GAME LOSS - DISQUALIFICATION WITHOUT PRIZE",
  "DISQUALIFICATION - DISQUALIFICATION WITHOUT PRIZE",
]);
/* Field order mirrors the VEKN Judges' Guide structure (Definition →
 * Example(s) → Philosophy → Penalty), with `sanction` carrying the
 * canonical Penalty severity for filtering and `correzione` carrying the
 * procedural prose that follows in the Penalty subsection. */
const ENTRY_KEYS = [
  "category",
  "infraction",
  "reference",
  "sanction",
  "description",
  "example",
  "philosophy",
  "correzione",
];

/**
 * Validate a single vademecum entry.
 * @param {unknown} entry
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateEntry(entry) {
  const errors = [];
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return { ok: false, errors: ["entry is not an object"] };
  }
  const e = /** @type {Record<string, unknown>} */ (entry);
  for (const k of ENTRY_KEYS) {
    if (!(k in e)) errors.push(`missing field: ${k}`);
    else if (typeof e[k] !== "string") errors.push(`field "${k}" is not a string`);
  }
  for (const k of Object.keys(e)) {
    if (!ENTRY_KEYS.includes(k)) errors.push(`unknown field: ${k}`);
  }
  if (typeof e.category === "string" && e.category.trim() === "") errors.push("category is empty");
  if (typeof e.infraction === "string" && e.infraction.trim() === "") errors.push("infraction is empty");
  if (typeof e.reference === "string" && !REFERENCE_RE.test(e.reference)) {
    errors.push(`reference "${e.reference}" does not match /^(|\\/\\/\\/|\\d+|\\d+\\s*-\\s*\\d+)$/`);
  }
  if (typeof e.sanction === "string" && !SANCTION_VALUES.has(e.sanction)) {
    errors.push(`sanction "${e.sanction}" is not in the canonical set`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validate the whole vademecum payload (must be an array of entries).
 * Returns the list of valid entries plus a flat list of issues for
 * diagnostics. Invalid entries are dropped, not coerced — so the runtime
 * UI shows "less" rather than rendering garbage.
 * @param {unknown} data
 * @returns {{ entries: object[], issues: { index: number, errors: string[] }[] }}
 */
export function validateData(data) {
  if (!Array.isArray(data)) {
    return { entries: [], issues: [{ index: -1, errors: ["payload is not an array"] }] };
  }
  /** @type {object[]} */
  const entries = [];
  /** @type {{ index: number, errors: string[] }[]} */
  const issues = [];
  data.forEach((entry, index) => {
    const { ok, errors } = validateEntry(entry);
    if (ok) entries.push(/** @type {object} */ (entry));
    else issues.push({ index, errors });
  });
  return { entries, issues };
}
