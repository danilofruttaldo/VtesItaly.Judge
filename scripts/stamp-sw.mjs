import { readFileSync, writeFileSync } from "node:fs";

const d = new Date();
const pad = (n) => String(n).padStart(2, "0");
const ts =
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
  `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;

const sw = readFileSync("sw.js", "utf8");
const next = sw.replace(/^const VERSION = ".*";$/m, `const VERSION = "${ts}";`);

if (next === sw) {
  console.error("stamp-sw: VERSION line not found in sw.js");
  process.exit(1);
}

writeFileSync("sw.js", next);
console.log(`const VERSION = "${ts}";`);
