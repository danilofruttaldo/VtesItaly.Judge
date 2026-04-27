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
 * a placeholder. The data uses "///" for situational/no-formal-sanction
 * cases and "???" for entries the editorial board hasn't decided yet. */
export const SANCTION_FALLBACKS = {
  "": "Da definire",
  "///": "Caso particolare — vedi descrizione",
  "???": "Da definire",
};

/* Parses the raw SANZIONE cell into a structured form so the rendering layer
 * can decide colors, badges, and filter membership without re-parsing.
 *
 * Returns one of:
 *   { kind: "single",      sanctions: ["CAUTION"],            description: "" }
 *   { kind: "multi",       sanctions: ["CAUTION","GAME LOSS"], description: "" }
 *   { kind: "placeholder", sanctions: [],                      description: "Da definire" }
 *
 * Multi-sanction cells use " - " as separator (e.g. "CAUTION - GAME LOSS"
 * for slow play, where the severity depends on intent). Both endpoints must
 * be canonical; otherwise the cell is treated as a placeholder.
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

/* Builds a deep-link to a specific rule on the Judges' Guide using the Text
 * Fragments URL extension. Returns null when the number isn't in the map so
 * callers can render plain text instead of a broken link. */
export function judgesGuideUrl(ruleNumber) {
  const title = JUDGES_GUIDE_RULES[ruleNumber];
  if (!title) return null;
  return `${JUDGES_GUIDE_URL}#:~:text=${encodeURIComponent(title)}`;
}

/* Parses a CSV "RIFERIMENTI" cell into one or more rule links.
 *
 * The cell contains either:
 *   - "" or "///" → no reference
 *   - a single number (e.g. "131")
 *   - a range "N1 - N2" (e.g. "141 - 162") which maps to TWO separate links:
 *     the start and end numbers. We don't expand the range because the rules
 *     between them aren't always relevant (the CSV uses the range as a "see
 *     these two rules" shorthand, not "every rule in between").
 *
 * Returns an array of { number, title, url } entries (possibly empty). The
 * url is null when the number is unknown — callers should fall back to plain
 * text in that case to avoid linking into thin air.
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

export function norm(s) {
  if (s === null || s === undefined) return "";
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const HTML_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

/* HTML-escapes `text` and wraps query matches in <mark>. The match is
 * accent- and case-insensitive (same equivalence class as norm()), so a
 * search for "perche" highlights "perché" in the source. Matches are
 * non-overlapping and rendered in the order they appear. Returns plain
 * escaped HTML when query is empty or has no hit. */
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

/* Stable, URL-safe slug for an item, derived from category + infraction.
 * Used as the DOM id of each card so that location.hash can deep-link to
 * a specific entry (e.g. share "#item-condotta-impropria-slow-play"). The
 * slug is intentionally derived (not authored) so judges don't need to
 * maintain ids in vademecum.json. Collisions are unlikely — category +
 * infraction is unique by editorial convention. */
export function itemSlug(item) {
  const base = `${item.category || ""} ${item.infraction || ""}`;
  return (
    norm(base)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

/* Returns true when the item matches the search query against any of the
 * searchable text fields. Empty query matches everything. The legacy
 * `notes` field is still accepted so older data snapshots remain
 * searchable until they're migrated. */
export function matchSearch(item, query) {
  const q = norm(query);
  if (!q) return true;
  const hay = [
    item.category,
    item.infraction,
    item.reference,
    item.sanction,
    item.description,
    item.intervention,
    item.notes,
  ]
    .map(norm)
    .join(" \n ");
  return hay.includes(q);
}

/* Filters by enabled sanction set. An empty set means "no filter active"
 * (equivalent to all enabled). Multi-sanction items match if ANY of their
 * sanctions is enabled (so filtering by CAUTION includes "CAUTION - GAME
 * LOSS" slow-play entries). Placeholder items ("???", "///", empty) fall
 * into the "TBD" bucket. */
export function matchSanction(item, enabled) {
  if (!enabled || enabled.size === 0) return true;
  const parsed = parseSanction(item.sanction);
  if (parsed.kind === "placeholder") return enabled.has("TBD");
  return parsed.sanctions.some((s) => enabled.has(s));
}

export function computeFiltered(items, query, enabledSanctions) {
  return items.filter((it) => matchSearch(it, query) && matchSanction(it, enabledSanctions));
}

export function groupByCategory(items) {
  const groups = new Map();
  for (const it of items) {
    const k = it.category || "—";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  return groups;
}
