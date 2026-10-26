// Minimal static file server for local development: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
};

// The ?film showreel (js/film.js) saves its video, shot list and stills here: PUT /__film/<name> -> docs/media/<name>
const FILM_FILE = /^\/__film\/((?:podglad\/)?[a-z0-9-]+\.(?:webm|md|jpg|json))$/;
async function saveFilm(req, res, name) {
  const parts = [];
  for await (const chunk of req) parts.push(chunk);
  const file = join(root, 'docs', 'media', name);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.concat(parts));
  console.log(`[film] ${name} ${(Buffer.concat(parts).length / 1048576).toFixed(1)} MB`);
  res.writeHead(204).end();
}

createServer(async (req, res) => {
  if (req.method === 'PUT') {
    const m = FILM_FILE.exec(new URL(req.url, 'http://localhost').pathname);
    if (!m) { res.writeHead(403).end(); return; }
    try { await saveFilm(req, res, m[1]); } catch (e) { res.writeHead(500).end(String(e)); }
    return;
  }
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  let file = join(root, path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (path.endsWith('/')) file = join(file, 'index.html');
  try {
    const body = await readFile(file);
    const type = types[extname(file)] || 'application/octet-stream';
    // byte ranges: a <video> seeks in a file only when the server can send a part of it
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      if (start > end || start >= body.length) { res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end(); return; }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' });
      res.end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', 511, () => console.log(`http://localhost:${port}/`));
