import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stampUpdated } from "./stamp-updated.mjs";

const SITE = "_site";

rmSync(SITE, { recursive: true, force: true });
mkdirSync(`${SITE}/data`, { recursive: true });

for (const f of [
  "index.html",
  "judges.html",
  "faq.html",
  "utili.html",
  "manifest.webmanifest",
  "sw.js",
  "robots.txt",
  ".nojekyll",
]) {
  cpSync(f, `${SITE}/${f}`);
}
if (existsSync("CNAME")) cpSync("CNAME", `${SITE}/CNAME`);

cpSync("assets", `${SITE}/assets`, { recursive: true });

if (!existsSync("data/vademecum.json")) {
  console.error("stage-site: data/vademecum.json missing — this is the canonical source, restore it.");
  process.exit(1);
}
cpSync("data/vademecum.json", `${SITE}/data/vademecum.json`);

// A shallow clone would date every file to the single fetched commit:
// CI checks out with fetch-depth: 0 and must not silently lose that.
const git = (/** @type {string[]} */ ...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("rev-parse", "--is-shallow-repository") === "true" && process.env.CI === "true") {
  console.error("stage-site: shallow clone, the vademecum date would be wrong. Use fetch-depth: 0.");
  process.exit(1);
}
const updated = git("log", "-1", "--format=%cI", "--", "data/vademecum.json");
if (updated) {
  const indexPath = `${SITE}/index.html`;
  writeFileSync(indexPath, stampUpdated(readFileSync(indexPath, "utf8"), updated));
} else {
  console.warn("stage-site: no commit for data/vademecum.json, 'Aggiornato' stays hidden.");
}

if (!existsSync("data/judges.json")) {
  console.error("stage-site: data/judges.json missing — run scripts/fetch-judges.mjs first.");
  process.exit(1);
}
cpSync("data/judges.json", `${SITE}/data/judges.json`);

if (!existsSync("data/faq.json")) {
  console.error("stage-site: data/faq.json missing — this is the canonical source, restore it.");
  process.exit(1);
}
cpSync("data/faq.json", `${SITE}/data/faq.json`);

// Sanity-check: by the time stage-site runs in CI, stamp-sw.mjs must have
// rewritten the placeholder "v1" VERSION to a UTC timestamp. If we ship
// the placeholder, every cache key collides across deploys and clients
// never see updates. Fail loudly here rather than ten minutes after the
// rollout when nobody can flush the SW.
const stagedSw = readFileSync(`${SITE}/sw.js`, "utf8");
const versionMatch = stagedSw.match(/^const VERSION = "(.*)";$/m);
if (!versionMatch) {
  console.error("stage-site: sw.js has no VERSION declaration. Did stamp-sw.mjs run?");
  process.exit(1);
}
if (versionMatch[1] === "v1" && process.env.CI === "true") {
  console.error(
    "stage-site: sw.js still has placeholder VERSION 'v1'. Run `node scripts/stamp-sw.mjs` before staging.",
  );
  process.exit(1);
}

/** @param {string} dir */
function dirSize(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    total += st.isDirectory() ? dirSize(p) : st.size;
  }
  return total;
}

const mb = (dirSize(SITE) / 1024 / 1024).toFixed(2);
console.log(`${SITE} staged: ${mb}MB`);
