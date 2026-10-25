// tools/build-dist.mjs
// Copies what the published site needs (index.html, css/, js/, LICENSE) into dist/ for Cloudflare Pages: no source
// data (data/, tools/data/), tools or tests. The site has no build step otherwise; js/bielany-geodata.js is generated
// by tools/geo-bielany.mjs beforehand.
//
// usage: node tools/build-dist.mjs [outDir]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const item of ['index.html', 'LICENSE', 'css', 'js']) {
  fs.cpSync(path.join(ROOT, item), path.join(OUT, item), { recursive: true });
}
// Cloudflare Pages headers: the modules revalidate on every load (the URLs carry no version)
fs.writeFileSync(path.join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
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
