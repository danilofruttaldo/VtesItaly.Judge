/* Cross-platform test discovery + runner for the JS suite.
 *
 * `node --test` accepts file paths, not glob patterns. Shell globbing for
 * `tests/**` requires bash `globstar`, which is OFF in most non-interactive
 * shells (including the Ubuntu runner used by GitHub Actions), so we walk
 * tests/ with node:fs and spawn `node --test` on the collected files.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} dir
 * @returns {string[]}
 */
function findJsTests(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findJsTests(p));
    } else if (/\.test\.m?js$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} label
 */
function run(cmd, args, label) {
  const res = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT });
  if (res.status !== 0) {
    console.error(`\n${label} failed with exit code ${res.status}`);
    process.exit(res.status ?? 1);
  }
}

const jsFiles = findJsTests(join(ROOT, "tests"));
if (jsFiles.length === 0) {
  console.error("run-tests: no *.test.mjs files found under tests/");
  process.exit(1);
}
run(process.execPath, ["--test", ...jsFiles], "node --test");
