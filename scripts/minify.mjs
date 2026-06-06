/* Minify runtime assets in place.
 *
 * Run as a post-stage step in CI (after copying sources into _site/) and
 * optionally locally via `npm run minify` to verify the bundle size. Reads and
 * overwrites the target paths, so always run it against a staged copy, never
 * against the source assets/ directory.
 */
import { build } from "esbuild";
import { readFileSync, statSync } from "node:fs";
import { argv } from "node:process";

const defaultTargets = [
  "_site/assets/app.js",
  "_site/assets/core.mjs",
  "_site/assets/judges.js",
  "_site/assets/faq.js",
  "_site/assets/styles.css",
  "_site/sw.js",
];

const targets = argv.length > 2 ? argv.slice(2) : defaultTargets;

/** @param {string} path */
function sizeKb(path) {
  return (statSync(path).size / 1024).toFixed(1);
}

for (const file of targets) {
  const before = parseFloat(sizeKb(file));
  const contents = readFileSync(file, "utf8");
  const loader = file.endsWith(".css") ? "css" : "js";
  await build({
    stdin: { contents, loader, sourcefile: file },
    minify: true,
    outfile: file,
    allowOverwrite: true,
    legalComments: "none",
    target: ["es2022"],
    write: true,
  });
  const after = parseFloat(sizeKb(file));
  const pct = (((before - after) / before) * 100).toFixed(0);
  console.log(`${file}: ${before} KB → ${after} KB (-${pct}%)`);
}
