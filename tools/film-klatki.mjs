// tools/film-klatki.mjs
// How smooth a recorded WebM is (the ?film showreel, js/film.js), without ffmpeg: reads the timestamp of every video
// frame (Matroska clusters and SimpleBlocks) and prints the size, codec, frames, duration and the gaps between frames.
// usage: node tools/film-klatki.mjs [docs/media/film-surowy.webm] [--json]

import { readFileSync } from 'node:fs';

const IDS = { SEGMENT: 0x18538067, CLUSTER: 0x1f43b675, TIMECODE: 0xe7, SIMPLEBLOCK: 0xa3, BLOCKGROUP: 0xa0, BLOCK: 0xa1,
  INFO: 0x1549a966, SCALE: 0x2ad7b1, TRACKS: 0x1654ae6b, ENTRY: 0xae, VIDEO: 0xe0, CODEC: 0x86, WIDTH: 0xb0, HEIGHT: 0xba };
const MASTERS = new Set([IDS.SEGMENT, IDS.CLUSTER, IDS.BLOCKGROUP, IDS.INFO, IDS.TRACKS, IDS.ENTRY, IDS.VIDEO]);

function vint(buf, pos, keepMarker) {
  const first = buf[pos];
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  let value = keepMarker ? first : first & (0xff >> len);
  let unknown = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + buf[pos + i];
    if (buf[pos + i] !== 0xff) unknown = false;
  }
  return { value, len, unknown: !keepMarker && unknown };
}

const uint = (buf, pos, len) => { let v = 0; for (let i = 0; i < len; i++) v = v * 256 + buf[pos + i]; return v; };

/** -> { width, height, codec, scale (ns), frames: [{ t (ms), key }] } */
function readWebm(buf) {
  const out = { width: 0, height: 0, codec: '', scale: 1e6, frames: [] };
  let cluster = 0;
  const block = (pos) => {
    const track = vint(buf, pos, false);
    const rel = buf.readInt16BE(pos + track.len);
    const flags = buf[pos + track.len + 2];
    out.frames.push({ t: ((cluster + rel) * out.scale) / 1e6, key: Boolean(flags & 0x80) });
  };
  const walk = (pos, end) => {
    while (pos < end - 1) {
      const id = vint(buf, pos, true);
      const size = vint(buf, pos + id.len, false);
      const body = pos + id.len + size.len;
      const stop = size.unknown ? end : Math.min(end, body + size.value);
      if (MASTERS.has(id.value)) {
        if (size.unknown) { pos = body; continue; } // Chrome writes the segment and the clusters open-ended
        walk(body, stop);
      } else if (id.value === IDS.TIMECODE) cluster = uint(buf, body, size.value);
      else if (id.value === IDS.SCALE) out.scale = uint(buf, body, size.value);
      else if (id.value === IDS.WIDTH) out.width = uint(buf, body, size.value);
      else if (id.value === IDS.HEIGHT) out.height = uint(buf, body, size.value);
      else if (id.value === IDS.CODEC) out.codec = buf.toString('ascii', body, stop);
      else if (id.value === IDS.SIMPLEBLOCK || id.value === IDS.BLOCK) block(body);
      pos = stop;
    }
  };
  walk(0, buf.length);
  out.frames.sort((a, b) => a.t - b.t);
  return out;
}

/** Gaps between frames (ms) -> the summary */
function summary(webm, fps = 60) {
  const f = webm.frames;
  const gaps = [];
  for (let i = 1; i < f.length; i++) gaps.push(f[i].t - f[i - 1].t);
  const budget = 1000 / fps;
  const sorted = [...gaps].sort((a, b) => a - b);
  const dur = f.length ? (f.at(-1).t - f[0].t) / 1000 : 0;
  return {
    width: webm.width, height: webm.height, codec: webm.codec,
    frames: f.length, keyframes: f.filter((x) => x.key).length,
    duration: Math.round(dur * 100) / 100,
    fps: dur ? Math.round(((f.length - 1) / dur) * 10) / 10 : 0,
    median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
    max: sorted.length ? sorted.at(-1) : 0,
    late: gaps.filter((g) => g > budget * 1.5).length, // a frame held twice or more
    long: gaps.map((g, i) => ({ at: Math.round(f[i].t) / 1000, gap: Math.round(g) })).filter((g) => g.gap > budget * 1.5).slice(0, 40),
  };
}

export { readWebm, summary };

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'docs/media/film-surowy.webm';
  const s = summary(readWebm(readFileSync(file)));
  if (process.argv.includes('--json')) console.log(JSON.stringify(s, null, 2));
  else {
    console.log(`${file}: ${s.width}×${s.height} ${s.codec}, ${s.frames} klatek (${s.keyframes} kluczowych), ${s.duration} s, ${s.fps} kl./s`);
    console.log(`odstęp: mediana ${s.median} ms, najdłuższy ${s.max} ms, spóźnione klatki: ${s.late}`);
    for (const g of s.long) console.log(`  ${g.at.toFixed(2)} s: ${g.gap} ms`);
  }
}
