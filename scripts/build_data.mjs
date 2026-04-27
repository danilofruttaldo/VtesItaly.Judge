/* Build data/vademecum.json from the source CSV in repo root.
 *
 * The CSV is the authoritative editable source (Google Sheets export). We bake
 * it to JSON so the static site can fetch a single asset without parsing CSV
 * client-side. TIPOLOGIA is forward-filled (sparse in the source). Placeholder
 * rows ("ALTRE PROPOSTE") are dropped.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function findCsv() {
  const matches = readdirSync(ROOT).filter((n) => /^vademecum.*\.csv$/i.test(n));
  if (matches.length === 0) {
    console.error("build_data: no Vademecum*.csv found in repo root");
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`build_data: multiple CSVs found: ${matches.join(", ")} — keep one.`);
    process.exit(1);
  }
  return join(ROOT, matches[0]);
}

/* Tiny RFC-4180-ish CSV parser. Handles quoted fields with embedded commas
 * and newlines, and "" as an escaped quote inside a quoted field. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\r") {
        // ignore — handled by \n
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const csvPath = findCsv();
const raw = readFileSync(csvPath, "utf8");
const rows = parseCsv(raw);

if (rows.length < 2) {
  console.error("build_data: CSV has no data rows");
  process.exit(1);
}

// First row is header. We use the first 5 columns; trailing "Column 6" is empty.
const header = rows[0].map((h) => h.trim());
const expected = ["TIPOLOGIA", "INFRAZIONE", "RIFERIMENTI AL JUDGES' GUIDE", "SANZIONE", "NOTE"];
for (let i = 0; i < expected.length; i++) {
  if (header[i] !== expected[i]) {
    console.error(`build_data: unexpected header[${i}] "${header[i]}", wanted "${expected[i]}"`);
    process.exit(1);
  }
}

const items = [];
let lastCategory = "";
for (let r = 1; r < rows.length; r++) {
  const [tipologia, infrazione, riferimenti, sanzione, note] = rows[r].map((v) => (v ?? "").trim());
  if (tipologia) lastCategory = tipologia;
  if (!infrazione) continue;
  if (infrazione.toUpperCase() === "ALTRE PROPOSTE") continue;
  items.push({
    category: lastCategory,
    infraction: infrazione,
    reference: riferimenti,
    sanction: sanzione,
    notes: note,
  });
}

mkdirSync("data", { recursive: true });
const out = {
  generated: new Date().toISOString(),
  source: csvPath.split(/[\\/]/).pop(),
  count: items.length,
  items,
};
writeFileSync("data/vademecum.json", JSON.stringify(out, null, 2) + "\n");
console.log(`build_data: ${items.length} entries → data/vademecum.json`);
