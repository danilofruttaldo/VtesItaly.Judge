/* Scrapes the judge directory of https://www.vtesexams.com (the VEKN judge
 * exams site), keeps the Italian judges, and writes a normalised snapshot to
 * data/judges.json. vekn.net/vekn-judges, the previous source, is gone: it
 * answers "404 Component not found" with HTTP 500.
 *
 * Designed to be safe to run unattended in CI on a cron:
 *   - Network errors, timeouts and 5xx responses are upstream outages: they
 *     emit a GitHub Actions warning and exit 0 WITHOUT touching
 *     data/judges.json, so the next cron tick simply retries.
 *   - 4xx responses, a page without the directory data or zero parsed
 *     Italian rows point at a moved page or changed markup: those exit
 *     non-zero, again without touching the file. Either way the previous
 *     snapshot stays in place — judges continue to see the last good list.
 *   - Output is sorted deterministically (rank tier → name) so the JSON
 *     diff is meaningful (a real list change), not row reshuffling noise.
 *
 * The page feeds its map from an inline `const guardians = [...]` JSON
 * array, one object per judge:
 *   { veknNumber, displayName, countryCode, judgeRank: "Elder" | "Ancilla"
 *     | "Neonate", accreditedOn: "yyyy-mm-dd", validUntil: "yyyy-mm-dd", … }
 * Parsing that array is sturdier than scraping the rendered cards.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://www.vtesexams.com/";
const TARGET_COUNTRY = "Italy";
const TARGET_COUNTRY_CODE = "IT";
const FETCH_TIMEOUT_MS = 30_000;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = resolve(ROOT, "data/judges.json");

/* Rank order mirrors the canonical VEKN judge tier (Elder = most senior).
 * Anything outside this set (e.g. a future rank) gets sorted to the bottom
 * but is still emitted, so the page stays informative if VEKN introduces
 * a new tier before we update the script. */
const RANK_ORDER = ["Elder Judge", "Ancilla Judge", "Neonate Judge"];

/**
 * Extract the inline `const guardians = [...]` array from the page. Returns
 * null when it is missing or not valid JSON (markup changed).
 * @param {string} html
 * @returns {unknown[] | null}
 */
function extractGuardians(html) {
  const marker = html.match(/\bconst\s+guardians\s*=\s*\[/);
  if (!marker || marker.index === undefined) return null;
  const begin = marker.index + marker[0].length - 1;
  // Walk to the matching bracket, skipping brackets inside JSON strings.
  let depth = 0;
  let inString = false;
  for (let i = begin; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) {
      try {
        const data = JSON.parse(html.slice(begin, i + 1));
        return Array.isArray(data) ? data : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Parse the vtesexams.com page and return the judges of one country, in the
 * data/judges.json row shape. Returns null when the directory data is
 * missing (moved page or changed markup). The caller sorts.
 * @param {string} html
 * @param {string} countryCode ISO 3166-1 alpha-2, e.g. "IT"
 */
export function parseJudges(html, countryCode) {
  const guardians = extractGuardians(html);
  if (!guardians) return null;
  /** @type {{ name: string, vekn_id: string, rank: string, valid_from: string, valid_to: string }[]} */
  const rows = [];
  for (const g of guardians) {
    const j = /** @type {Record<string, unknown>} */ (g);
    if (j.countryCode !== countryCode) continue;
    const name = String(j.displayName ?? "").trim();
    const veknId = String(j.veknNumber ?? "").trim();
    if (!name || !veknId) continue;
    rows.push({
      name,
      vekn_id: veknId,
      rank: `${String(j.judgeRank ?? "").trim()} Judge`,
      valid_from: String(j.accreditedOn ?? ""),
      valid_to: String(j.validUntil ?? ""),
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
 * @param {NonNullable<ReturnType<typeof parseJudges>>} rows
 */
function sortJudges(rows) {
  const coll = new Intl.Collator("it-IT", { sensitivity: "base" });
  return [...rows].sort((a, b) => rankTier(a.rank) - rankTier(b.rank) || coll.compare(a.name, b.name));
}

/** Upstream outage: not actionable on our side, so warn and leave the
 *  snapshot untouched instead of failing the job.
 *  @param {string} reason */
function skipOutage(reason) {
  console.log(`::warning title=vtesexams.com unavailable::${reason} — keeping the previous snapshot.`);
}

async function main() {
  let res;
  try {
    res = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent": "vtes-italy-judge-refresh/1.0 (+https://judge.vtesitaly.com)",
        Accept: "text/html",
      },
      // A hung server must end in the outage branch, not in the job timeout.
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    return skipOutage(`fetch-judges: ${SOURCE_URL} unreachable (${err instanceof Error ? err.message : err})`);
  }
  if (res.status >= 500) {
    return skipOutage(`fetch-judges: ${SOURCE_URL} returned HTTP ${res.status}`);
  }
  if (!res.ok) {
    console.error(`fetch-judges: ${SOURCE_URL} returned HTTP ${res.status}`);
    process.exit(1);
  }
  const html = await res.text();
  const parsed = parseJudges(html, TARGET_COUNTRY_CODE);
  if (!parsed) {
    console.error(
      `fetch-judges: no \`const guardians = [...]\` data in ${SOURCE_URL}: the page moved or changed markup. ` +
        `Not touching ${OUT_PATH}.`,
    );
    process.exit(1);
  }
  const rows = sortJudges(parsed);

  if (rows.length === 0) {
    console.error(
      `fetch-judges: parsed 0 judges for ${TARGET_COUNTRY}. ` +
        `Either all Italian judges were removed (unlikely) or the data shape changed. ` +
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
