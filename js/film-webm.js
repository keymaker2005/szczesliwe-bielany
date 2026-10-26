// js/film-webm.js
// A minimal WebM (Matroska) writer for the ?film showreel (js/film.js): one video track of encoded VP8 / VP9 frames
// from WebCodecs, each with its own exact timestamp, so the file plays at a steady 60 frames a second however long a
// frame took to render. Clusters start at the keyframes; every element is written with a known size, and a seek head
// at the start points to the cues (the keyframe index) at the end, so players can jump anywhere in the file. No DOM:
// the tests build files with it.

const enc = new TextEncoder();

function idBytes(id) {
  const out = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return out;
}

// An element's size as an 8-byte EBML number
function sizeBytes(n) {
  const out = new Uint8Array(8);
  out[0] = 0x01;
  let v = n;
  for (let i = 7; i >= 1; i--) { out[i] = v % 256; v = Math.floor(v / 256); }
  return out;
}

function uintBytes(v) {
  const out = [];
  do { out.unshift(v % 256); v = Math.floor(v / 256); } while (v > 0);
  return new Uint8Array(out);
}

// A number in 8 bytes: the positions in the seek head and the cues keep their size whatever they are
function uint8Bytes(v) {
  const out = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { out[i] = v % 256; v = Math.floor(v / 256); }
  return out;
}

function floatBytes(v) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, v);
  return b;
}

const byteLength = (parts) => parts.reduce((a, p) => a + p.length, 0);

/** An element: id and its body (Uint8Array, or a list of them) -> a list of Uint8Arrays */
function element(id, body) {
  const parts = Array.isArray(body) ? body : [body];
  return [new Uint8Array(idBytes(id)), sizeBytes(byteLength(parts)), ...parts];
}

const uintEl = (id, v) => element(id, uintBytes(v));
const strEl = (id, s) => element(id, enc.encode(s));
const INFO = 0x1549a966, TRACKS = 0x1654ae6b, CUES = 0x1c53bb6b, CLUSTER = 0x1f43b675;

// The seek head: where the info, the tracks and the cues are (from the start of the segment's body)
const seekHead = (at) => element(0x114d9b74, [INFO, TRACKS, CUES].flatMap((id, i) => element(0x4dbb, [
  ...element(0x53ab, new Uint8Array(idBytes(id))), ...element(0x53ac, uint8Bytes(at[i])),
])));

/**
 * frames: [{ data: Uint8Array, timestamp (µs), key: boolean }] in order; codec 'V_VP9' | 'V_VP8'
 * -> a list of Uint8Arrays (new Blob(list, { type: 'video/webm' }))
 */
function muxWebm({ frames, width, height, fps = 60, codec = 'V_VP9', app = 'Szczesliwe Bielany ?film' }) {
  const last = frames.at(-1);
  const durationMs = last ? last.timestamp / 1000 + 1000 / fps : 0;
  const header = element(0x1a45dfa3, [
    ...uintEl(0x4286, 1), ...uintEl(0x42f7, 1), ...uintEl(0x42f2, 4), ...uintEl(0x42f3, 8),
    ...strEl(0x4282, 'webm'), ...uintEl(0x4287, 4), ...uintEl(0x4285, 2),
  ]);
  const info = element(INFO, [
    ...uintEl(0x2ad7b1, 1000000), ...element(0x4489, floatBytes(durationMs)), ...strEl(0x4d80, app), ...strEl(0x5741, app),
  ]);
  const tracks = element(TRACKS, element(0xae, [
    ...uintEl(0xd7, 1), ...uintEl(0x73c5, 1), ...uintEl(0x83, 1), ...strEl(0x86, codec),
    ...uintEl(0x23e383, Math.round(1e9 / fps)),
    ...element(0xe0, [...uintEl(0xb0, width), ...uintEl(0xba, height)]),
  ]));
  const head = byteLength(seekHead([0, 0, 0])); // its size doesn't depend on the positions
  let pos = head + byteLength(info) + byteLength(tracks); // where the next cluster goes
  const clusters = [];
  const cues = [];
  let cluster = null;
  const flush = () => {
    if (!cluster) return;
    const el = element(CLUSTER, cluster.parts);
    cues.push(...element(0xbb, [...element(0xb3, uint8Bytes(cluster.start)),
      ...element(0xb7, [...uintEl(0xf7, 1), ...element(0xf1, uint8Bytes(pos))])]));
    pos += byteLength(el);
    clusters.push(...el);
  };
  for (const f of frames) {
    const ms = Math.round(f.timestamp / 1000);
    if (!cluster || f.key || ms - cluster.start > 30000) {
      flush();
      cluster = { start: ms, parts: [...uintEl(0xe7, ms)] };
    }
    const block = new Uint8Array(4);
    block[0] = 0x81; // track 1
    new DataView(block.buffer).setInt16(1, ms - cluster.start);
    block[3] = f.key ? 0x80 : 0;
    cluster.parts.push(...element(0xa3, [block, f.data]));
  }
  flush();
  const seek = seekHead([head, head + byteLength(info), pos]);
  return [...header, ...element(0x18538067, [...seek, ...info, ...tracks, ...clusters, ...element(CUES, cues)])];
}

export { muxWebm };
