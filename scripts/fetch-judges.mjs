/* Scrapes https://www.vekn.net/vekn-judges, filters Italian judges, and
 * writes a normalised snapshot to data/judges.json.
 *
 * Designed to be safe to run unattended in CI on a cron:
 *   - Network errors, non-200 responses, or zero parsed Italian rows exit
 *     non-zero WITHOUT touching data/judges.json. The workflow only commits
 *     on a clean diff, so a transient failure leaves the previous snapshot
 *     in place — judges continue to see the last good list.
 *   - Output is sorted deterministically (rank tier → name) so the JSON
 *     diff is meaningful (a real list change), not row reshuffling noise.
 *
 * VEKN currently serves a flat HTML table with 7 <td> per row:
 *   [index, name, vekn_id, country, rank, valid_from, valid_to]
 * The parser is intentionally minimal — a regex over <tr>…</tr> blocks
 * with cheerio-free <td> capture. If VEKN changes the structure we fail
 * loudly here rather than ship garbage to /about.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://www.vekn.net/vekn-judges";
const TARGET_COUNTRY = "Italy";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = resolve(ROOT, "data/judges.json");

/* Rank order mirrors the canonical VEKN judge tier (Elder = most senior).
 * Anything outside this set (e.g. a future rank) gets sorted to the bottom
 * but is still emitted, so the page stays informative if VEKN introduces
 * a new tier before we update the script. */
const RANK_ORDER = ["Elder Judge", "Ancilla Judge", "Neonate Judge"];

/** @param {string} html */
function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

/** @param {string} s */
function normSpace(s) {
  return s.replace(/\s+/g, " ").trim();
}

/** Reformat a "dd/mm/yyyy" date to ISO "yyyy-mm-dd" so sorting and
 *  display are unambiguous. Returns the input unchanged if it doesn't
 *  match — defensive, but VEKN has been consistent in practice. */
/** @param {string} s */
function toIsoDate(s) {
  const m = normSpace(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return normSpace(s);
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Parse the VEKN judges HTML and return raw row objects for the requested
 * country. The caller is responsible for further validation / sorting.
 * @param {string} html
 * @param {string} country
 */
export function parseJudges(html, country) {
  /** @type {{ name: string, vekn_id: string, rank: string, valid_from: string, valid_to: string }[]} */
  const rows = [];

  // Capture every <tr>…</tr> non-greedily. The page only has a single
  // table of judges, so we don't need to scope by table — but we skip any
  // row that doesn't yield exactly 7 cells (header rows, malformed rows).
  const trMatches = html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const tr of trMatches) {
    const cells = [...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => normSpace(stripTags(c[1])));
    if (cells.length !== 7) continue;
    const [, name, veknId, rowCountry, rank, validFrom, validTo] = cells;
    if (rowCountry !== country) continue;
    if (!name || !veknId) continue;
    rows.push({
      name,
      vekn_id: veknId,
      rank,
      valid_from: toIsoDate(validFrom),
      valid_to: toIsoDate(validTo),
    });
  }
  return rows;
}

/** @param {string} rank */
function rankTier(rank) {
  const i = RANK_ORDER.indexOf(rank);
  return i === -1 ? RANK_ORDER.length : i;
}

/**
 * Stable ordering: first by rank tier (Elder > Ancilla > Neonate > other),
 * then by name (it-IT collation, case-insensitive). Names with diacritics
 * sort against their base letter so "Donà" follows "Donati" rather than
 * being pushed to the bottom of the alphabet.
 * @param {ReturnType<typeof parseJudges>} rows
 */
function sortJudges(rows) {
  const coll = new Intl.Collator("it-IT", { sensitivity: "base" });
  return [...rows].sort((a, b) => rankTier(a.rank) - rankTier(b.rank) || coll.compare(a.name, b.name));
}

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "vtes-italy-judge-refresh/1.0 (+https://judge.vtesitaly.com)",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    console.error(`fetch-judges: ${SOURCE_URL} returned HTTP ${res.status}`);
    process.exit(1);
  }
  const html = await res.text();
  const rows = sortJudges(parseJudges(html, TARGET_COUNTRY));

  if (rows.length === 0) {
    console.error(
      `fetch-judges: parsed 0 judges for ${TARGET_COUNTRY}. ` +
        `Either VEKN removed all Italian judges (unlikely) or the page markup changed. ` +
        `Not touching ${OUT_PATH}.`,
    );
    process.exit(1);
  }

  const previous = (() => {
    try {
      return JSON.parse(readFileSync(OUT_PATH, "utf8"));
    } catch {
      return null;
    }
  })();

  const payload = {
    source: SOURCE_URL,
    country: TARGET_COUNTRY,
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    judges: rows,
  };

  // Don't bump generated_at on a no-op rerun: if the judge list is
  // byte-identical, keep the previous timestamp so the file is a true
  // no-op for git and the workflow won't open an empty commit.
  if (previous && JSON.stringify(previous.judges) === JSON.stringify(rows)) {
    payload.generated_at = previous.generated_at;
  }

  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`fetch-judges: wrote ${rows.length} judges to ${OUT_PATH}`);
}

// ESM entrypoint guard — when imported by tests, main() doesn't run.
const isEntry = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  main().catch((err) => {
    console.error("fetch-judges: unexpected failure", err);
    process.exit(1);
  });
}
