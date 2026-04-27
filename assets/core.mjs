/* Pure, DOM-free helpers for tests (node --test) and runtime use.
 * Mutation happens in app.js; everything here is a plain transformation.
 */

export const SANCTION_ORDER = ["CAUTION", "WARNING", "GAME LOSS", "DISQUALIFICATION", "DISQUALIFICATION WITHOUT PRIZE"];

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

/* Returns true when the item matches the search query against any of the
 * searchable text fields. Empty query matches everything. */
export function matchSearch(item, query) {
  const q = norm(query);
  if (!q) return true;
  const hay = [item.category, item.infraction, item.reference, item.sanction, item.notes].map(norm).join(" \n ");
  return hay.includes(q);
}

/* Filters by enabled sanction set. An empty set means "no filter active"
 * (equivalent to all enabled). Items with non-standard sanction strings
 * (empty, "???", "///", "CAUTION - GAME LOSS") fall into the "OTHER" bucket. */
export function matchSanction(item, enabled) {
  if (!enabled || enabled.size === 0) return true;
  const s = (item.sanction || "").trim();
  if (SANCTION_ORDER.includes(s)) return enabled.has(s);
  return enabled.has("OTHER");
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
