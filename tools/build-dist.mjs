// tools/build-dist.mjs
// Copies what the published site needs (index.html, css/, js/, LICENSE) into dist/ for Cloudflare Pages: no source
// data (data/, tools/data/), tools or tests. The site has no build step otherwise; js/bielany-geodata.js is generated
// by tools/geo-bielany.mjs beforehand.
//
// usage: node tools/build-dist.mjs [outDir]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const item of ['index.html', 'LICENSE', 'css', 'js']) {
  fs.cpSync(path.join(ROOT, item), path.join(OUT, item), { recursive: true });
}
// The ?film showreel (js/film.js, js/film-plan.js) records on localhost only: not published
for (const f of ['film.js', 'film-plan.js']) fs.rmSync(path.join(OUT, 'js', f), { force: true });
// Every module URL carries the build (?v=<commit>): a browser that kept an older module in its cache cannot mix it
// with a newer page (seen after the 1.5 deploy: the new index.html ran with the old main.js)
const head = spawnSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
const BUILD = (head.stdout || '').trim() || String(Date.now());
const versioned = (text) => text.replace(/(["'])(\.\.?\/(?:js\/|css\/)?[\w-]+\.(?:js|css))(?:\?v=[^"']*)?\1/g, (m, q, url) => `${q}${url}?v=${BUILD}${q}`);
const walkFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const file of walkFiles(OUT)) {
  if (!/\.(js|html)$/.test(file)) continue;
  fs.writeFileSync(file, versioned(fs.readFileSync(file, 'utf8')));
}
// Cloudflare Pages headers: the page itself revalidates on every load, the versioned modules can stay cached
fs.writeFileSync(path.join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/js/*
  Cache-Control: public, max-age=0, must-revalidate
/css/*
  Cache-Control: public, max-age=0, must-revalidate
`);

let files = 0, bytes = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { files++; bytes += fs.statSync(p).size; }
  }
};
walk(OUT);
console.log(`[dist] ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB in ${OUT}`);
