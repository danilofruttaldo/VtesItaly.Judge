import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const SITE = "_site";

rmSync(SITE, { recursive: true, force: true });
mkdirSync(`${SITE}/data`, { recursive: true });

for (const f of ["index.html", "manifest.webmanifest", "sw.js", "robots.txt", ".nojekyll"]) {
  cpSync(f, `${SITE}/${f}`);
}
if (existsSync("CNAME")) cpSync("CNAME", `${SITE}/CNAME`);

cpSync("assets", `${SITE}/assets`, { recursive: true });

if (!existsSync("data/vademecum.json")) {
  console.error("stage-site: data/vademecum.json missing — run `npm run build:data` first.");
  process.exit(1);
}
cpSync("data/vademecum.json", `${SITE}/data/vademecum.json`);

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
