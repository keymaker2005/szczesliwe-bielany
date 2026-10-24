// tools/report-bielany.mjs
// Step 0.2 data report for the Bielany MVP bbox: GUGiK LoD1 buildings checked against OpenStreetMap, street and
// track lengths, address coverage. Writes docs/raport-0.2.md (numbers) and docs/raport-0.2.html (numbers + map).
// Frame: 1 unit = 1 m, x = east, z = south (north = -z), origin at the Stare Bielany metro station, no rotation.
//
// Inputs:
//   data/bielany_lod1_2024.geojson   GUGiK LoD1 2024 cut-out (data/extract_bielany_lod1.py)
//   tools/data/osm_bielany_*.json    OpenStreetMap via Overpass (tools/overpass.sh + tools/data/q_bielany_*.overpassql)
//
// usage: node tools/report-bielany.mjs

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(ROOT + f, 'utf8'));
const osm = (n) => read(`tools/data/osm_bielany_${n}.json`).elements;

const BBOX = { s: 52.274, w: 20.915, n: 52.3, e: 20.96 };

// =====================================================================================================================
// 1. FRAME
// =====================================================================================================================
const rail = osm('rail');
const station = rail.find((e) => e.type === 'node' && e.tags?.name === 'Stare Bielany' && e.tags?.station === 'subway');
const LAT0 = station.lat;
const LON0 = station.lon;
const A = 6378137.0;
const E2 = 6.69437999014e-3;
const PHI0 = (LAT0 * Math.PI) / 180;
const SIN0 = Math.sin(PHI0);
const KX = (Math.PI / 180) * (A / Math.sqrt(1 - E2 * SIN0 * SIN0)) * Math.cos(PHI0);
const KY = (Math.PI / 180) * ((A * (1 - E2)) / Math.pow(1 - E2 * SIN0 * SIN0, 1.5));
const toWorld = (lon, lat) => [(lon - LON0) * KX, -(lat - LAT0) * KY];

const [X0, Z1] = toWorld(BBOX.w, BBOX.s);
const [X1, Z0] = toWorld(BBOX.e, BBOX.n);

// =====================================================================================================================
// 2. GEOMETRY HELPERS
// =====================================================================================================================
function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(a / 2);
}
function centroid(r) {
  let x = 0, z = 0;
  for (const p of r) { x += p[0]; z += p[1]; }
  return [x / r.length, z / r.length];
}
function pointInRing(p, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i], [xj, zj] = r[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
// Liang-Barsky: length of segment a-b inside the bbox
function clippedLength(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, a[0] - X0], [dx, X1 - a[0]], [-dz, a[1] - Z0], [dz, Z1 - a[1]]]) {
    if (p === 0) { if (q < 0) return 0; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return 0; if (t > t0) t0 = t; } else { if (t < t0) return 0; if (t < t1) t1 = t; }
  }
  return (t1 - t0) * Math.hypot(dx, dz);
}
const lineLength = (pts) => pts.slice(1).reduce((s, p, i) => s + clippedLength(pts[i], p), 0);
const inBox = (p) => p[0] >= X0 && p[0] <= X1 && p[1] >= Z0 && p[1] <= Z1;
const wayPts = (e) => (e.geometry || []).map((g) => toWorld(g.lon, g.lat));
const outerRings = (e) => e.type === 'way'
  ? [wayPts(e)]
  : (e.members || []).filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry.map((g) => toWorld(g.lon, g.lat)));

// Uniform grid over polygons for fast point lookups
class PolyIndex {
  constructor(polys, cell = 50) {
    this.cell = cell; this.polys = polys; this.grid = new Map();
    polys.forEach((poly, i) => {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const [x, z] of poly.ring) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
      for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++)
        for (let gz = Math.floor(z0 / cell); gz <= Math.floor(z1 / cell); gz++) {
          const k = gx + ',' + gz;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(i);
        }
    });
  }
  find(p) {
    for (const i of this.grid.get(Math.floor(p[0] / this.cell) + ',' + Math.floor(p[1] / this.cell)) || [])
      if (pointInRing(p, this.polys[i].ring)) return i;
    return -1;
  }
}

const fmt = (n, d = 0) => n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (a, b) => (b ? fmt((100 * a) / b, 1) + ' %' : '-');
const km = (m) => fmt(m / 1000, 1) + ' km';

// =====================================================================================================================
// 3. BUILDINGS: LoD1 vs OSM
// =====================================================================================================================
const lod1 = read('data/bielany_lod1_2024.geojson').features.map((f) => {
  const ring = f.geometry.coordinates[0].map(([lon, lat]) => toWorld(lon, lat));
  return { ring, h: f.properties.height_m, year: f.properties.source_year, area: ringArea(ring) };
});
const osmB = osm('buildings').flatMap((e) => outerRings(e).filter((r) => r.length > 3).map((ring) => ({
  ring, area: ringArea(ring), levels: Number(e.tags?.['building:levels']) || 0, height: parseFloat(e.tags?.height) || 0,
  name: e.tags?.name,
}))).filter((b) => inBox(centroid(b.ring)));

const osmIdx = new PolyIndex(osmB);
const lodIdx = new PolyIndex(lod1);
// A building matches when its centroid, or a vertex pulled 20 % towards the centroid, lies inside a building of the
// other source (L- and U-shaped blocks have their centroid in the courtyard)
const samples = (ring) => { const c = centroid(ring); return [c, ...ring.map(([x, z]) => [x + (c[0] - x) * 0.2, z + (c[1] - z) * 0.2])]; };
const pointInOwn = (ring) => (p) => pointInRing(p, ring);
const matches = (b, idx) => samples(b.ring).filter(pointInOwn(b.ring)).some((p) => idx.find(p) >= 0);
const lodMatched = lod1.filter((b) => matches(b, osmIdx));
const osmMatched = osmB.filter((b) => matches(b, lodIdx));
const big = (b) => b.area >= 100;
const lodBig = lod1.filter(big), osmBig = osmB.filter(big);
const lodBigMatched = lodBig.filter((b) => matches(b, osmIdx));
const osmBigMissing = osmBig.filter((b) => !matches(b, lodIdx));

const heights = lod1.map((b) => b.h).sort((a, b) => a - b);
const q = (p) => heights[Math.min(heights.length - 1, Math.floor(p * heights.length))];
const BINS = [[0, 6], [6, 12], [12, 20], [20, 35], [35, Infinity]];
const hist = BINS.map(([a, b]) => heights.filter((h) => h >= a && h < b).length);
const years = {};
for (const b of lod1) years[b.year] = (years[b.year] || 0) + 1;

// Height sanity: LoD1 height vs OSM building:levels * 3 m where both exist
const levelPairs = lod1.flatMap((b) => {
  const i = osmIdx.find(centroid(b.ring));
  return i >= 0 && osmB[i].levels ? [[b.h, osmB[i].levels]] : [];
});
const levelErr = levelPairs.map(([h, l]) => Math.abs(h - l * 3)).sort((a, b) => a - b);
const tallest = [...lod1].sort((a, b) => b.h - a.h).slice(0, 5).map((b) => {
  const [x, z] = centroid(b.ring);
  const i = osmIdx.find([x, z]);
  return { h: b.h, x, z, name: i >= 0 ? osmB[i].name : undefined };
});

// =====================================================================================================================
// 4. STREETS AND TRACKS
// =====================================================================================================================
const ROAD_CLASSES = {
  'główne (trunk, primary, secondary)': ['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link'],
  'lokalne (tertiary, unclassified, residential)': ['tertiary', 'tertiary_link', 'unclassified', 'residential'],
  'osiedlowe i dojazdy (service, living_street)': ['service', 'living_street'],
  'piesze i rowerowe (footway, path, cycleway, pedestrian, steps)': ['footway', 'path', 'cycleway', 'pedestrian', 'steps', 'bridleway', 'corridor'],
};
const streets = osm('streets').map((e) => ({ hw: e.tags.highway, name: e.tags.name, len: lineLength(wayPts(e)), pts: wayPts(e) }));
const byClass = Object.entries(ROAD_CLASSES).map(([label, list]) => [label, streets.filter((s) => list.includes(s.hw)).reduce((a, s) => a + s.len, 0)]);
const otherLen = streets.filter((s) => !Object.values(ROAD_CLASSES).flat().includes(s.hw)).reduce((a, s) => a + s.len, 0);
const drivable = streets.filter((s) => [...ROAD_CLASSES[Object.keys(ROAD_CLASSES)[0]], ...ROAD_CLASSES[Object.keys(ROAD_CLASSES)[1]]].includes(s.hw));
const drivableLen = drivable.reduce((a, s) => a + s.len, 0);
const namedLen = drivable.filter((s) => s.name).reduce((a, s) => a + s.len, 0);
const streetNames = new Set(streets.filter((s) => s.name && s.len > 0).map((s) => s.name));

const tracks = rail.filter((e) => e.type === 'way').map((e) => ({
  kind: e.tags.railway, tunnel: e.tags.tunnel === 'yes' || e.tags.layer < 0, len: lineLength(wayPts(e)), pts: wayPts(e),
}));
const trackLen = (k, tunnel) => tracks.filter((t) => t.kind === k && (tunnel === undefined || t.tunnel === tunnel)).reduce((a, t) => a + t.len, 0);
const stations = rail.filter((e) => e.type === 'node' && e.tags?.station === 'subway').map((e) => ({ name: e.tags.name, p: toWorld(e.lon, e.lat) }));
const tramStops = new Set(rail.filter((e) => e.type === 'node' && e.tags?.railway === 'tram_stop').map((e) => e.tags.name?.replace(/\s+\d+$/, '')));

// =====================================================================================================================
// 5. NAMES AND ADDRESSES
// =====================================================================================================================
// Keep features whose centre lies in the bbox (admin boundaries of Białołęka or Żerań only clip its edge)
const featureCentre = (e) => {
  if (e.type === 'node') return toWorld(e.lon, e.lat);
  const pts = outerRings(e).flat();
  return pts.length ? centroid(pts) : [Infinity, Infinity];
};
const places = osm('places').filter((e) => inBox(featureCentre(e)));
const placeNames = (filter) => [...new Set(places.filter(filter).map((e) => e.tags?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
const quarters = placeNames((e) => e.tags?.place && e.tags.place !== 'locality' || e.tags?.boundary === 'administrative');
const landmarks = placeNames((e) => e.tags?.amenity || e.tags?.leisure);

const addrs = osm('addresses').map((e) => ({
  p: e.type === 'node' ? toWorld(e.lon, e.lat) : toWorld(e.center.lon, e.center.lat),
  street: e.tags['addr:street'] || e.tags['addr:place'], num: e.tags['addr:housenumber'],
})).filter((a) => inBox(a.p));
const addrWithStreet = addrs.filter((a) => a.street).length;
const lodWithAddr = new Set(addrs.map((a) => lodIdx.find(a.p)).filter((i) => i >= 0));
const lodBigWithAddr = lodBig.filter((b) => lodWithAddr.has(lod1.indexOf(b))).length;
const addrStreets = new Set(addrs.map((a) => a.street).filter(Boolean));

// =====================================================================================================================
// 6. OUTPUT
// =====================================================================================================================
const stats = {
  lod1: lod1.length, osm: osmB.length, lodMatched: lodMatched.length, osmMatched: osmMatched.length,
  lodBig: lodBig.length, lodBigMatched: lodBigMatched.length, osmBig: osmBig.length, osmBigMissing: osmBigMissing.length,
  hmin: heights[0], hmed: q(0.5), hp90: q(0.9), hmax: heights.at(-1), hist, years,
  levelPairs: levelPairs.length, levelErrMed: levelErr[Math.floor(levelErr.length / 2)], levelErrP90: levelErr[Math.floor(levelErr.length * 0.9)],
  streetsTotal: streets.reduce((a, s) => a + s.len, 0), byClass, otherLen, drivableLen, namedLen, streetNames: streetNames.size,
  tram: trackLen('tram'), subwayTunnel: trackLen('subway', true), subwaySurface: trackLen('subway', false), railLen: trackLen('rail'),
  addrs: addrs.length, addrWithStreet, lodWithAddr: lodWithAddr.size, lodBigWithAddr, addrStreets: addrStreets.size,
};

const md = `# Raport kroku 0.2: dane dla bbox Bielan

Bbox (WGS84): ${BBOX.s},${BBOX.w} do ${BBOX.n},${BBOX.e}, czyli ok. ${fmt((X1 - X0) / 1000, 2)} km (wsch.-zach.) na ${fmt((Z1 - Z0) / 1000, 2)} km (płn.-płd.), ${fmt(((X1 - X0) * (Z1 - Z0)) / 1e6, 1)} km².
Punkt zerowy: stacja metra Stare Bielany (${LAT0.toFixed(5)}, ${LON0.toFixed(5)}).
Źródła: GUGiK LoD1 2024 (CC BY 4.0), OpenStreetMap przez Overpass, pobrane ${new Date().toISOString().slice(0, 10)} (ODbL).
Skrypt: \`node tools/report-bielany.mjs\`.

## Budynki

| | LoD1 (GUGiK) | OSM |
| --- | ---: | ---: |
| liczba budynków w bbox | ${fmt(stats.lod1)} | ${fmt(stats.osm)} |
| w tym o powierzchni ≥ 100 m² | ${fmt(stats.lodBig)} | ${fmt(stats.osmBig)} |
| pokrywa się z drugim źródłem (punkt wewnątrz obrysu leży w budynku z drugiego źródła) | ${fmt(stats.lodMatched)} (${pct(stats.lodMatched, stats.lod1)}) | ${fmt(stats.osmMatched)} (${pct(stats.osmMatched, stats.osm)}) |
| budynki ≥ 100 m² z LoD1 obecne w OSM | ${fmt(stats.lodBigMatched)} (${pct(stats.lodBigMatched, stats.lodBig)}) | |
| budynki ≥ 100 m² z OSM, których brak w LoD1 | | ${fmt(stats.osmBigMissing)} |

Rok pomiaru w LoD1 (pole source_year): ${Object.entries(years).sort().map(([y, n]) => `${y}: ${fmt(n)}`).join(', ')}. Paczka to wydanie 2024, ale pomiar pochodzi z 2023 r.

### Wysokości LoD1

- min ${fmt(stats.hmin, 1)} m, mediana ${fmt(stats.hmed, 1)} m, 90. percentyl ${fmt(stats.hp90, 1)} m, max ${fmt(stats.hmax, 1)} m.
- Rozkład: ${BINS.map(([a, b], i) => `${a}-${b === Infinity ? '' : b} m: ${fmt(hist[i])}`).join('; ').replace('35- m', 'powyżej 35 m')}.
- Kontrola z OSM (building:levels × 3 m): ${fmt(stats.levelPairs)} par, mediana różnicy ${fmt(stats.levelErrMed ?? 0, 1)} m, 90 % par mieści się w ${fmt(stats.levelErrP90 ?? 0, 1)} m.
- Najwyższe: ${tallest.map((t) => `${fmt(t.h, 1)} m${t.name ? ` (${t.name})` : ''} przy x=${fmt(t.x)}, z=${fmt(t.z)}`).join('; ')}.

## Ulice i tory (długość przycięta do bbox)

| Kategoria | Długość |
| --- | ---: |
${byClass.map(([l, v]) => `| ${l} | ${km(v)} |`).join('\n')}
| pozostałe (drogi gruntowe, w budowie, perony itd.) | ${km(otherLen)} |
| **razem** | **${km(stats.streetsTotal)}** |

- Jezdnie dla aut (główne + lokalne): ${km(drivableLen)}, z nazwą ulicy: ${pct(namedLen, drivableLen)}.
- Liczba różnych nazw ulic i ścieżek: ${fmt(stats.streetNames)}.
- Tory tramwajowe: ${km(stats.tram)} (toru pojedynczego, czyli linie dwutorowe liczone podwójnie).
- Metro M1: ${km(stats.subwayTunnel)} w tunelu, ${km(stats.subwaySurface)} na powierzchni.
- Kolej: ${km(stats.railLen)} (bocznice przemysłowe huty ArcelorMittal Warszawa, bez ruchu pasażerskiego).
- Stacje metra w bbox: ${stations.map((s) => `${s.name} (x=${fmt(s.p[0])}, z=${fmt(s.p[1])})`).join(', ')}.
- Przystanki tramwajowe: ${fmt(tramStops.size)} (${[...tramStops].sort((a, b) => a.localeCompare(b, 'pl')).join(', ')}).

## Nazwy

- Osiedla i części dzielnicy: ${quarters.join(', ')}.
- Wybrane obiekty z nazwą (szkoły, uczelnie, szpitale, kościoły, parki): ${fmt(landmarks.length)}, np. ${landmarks.slice(0, 15).join(', ')}.

## Adresy

- Punkty adresowe w OSM: ${fmt(stats.addrs)}, z nazwą ulicy lub placu: ${pct(stats.addrWithStreet, stats.addrs)}.
- Ulice występujące w adresach: ${fmt(stats.addrStreets)}.
- Budynki LoD1 z co najmniej jednym adresem: ${fmt(stats.lodWithAddr)} z ${fmt(stats.lod1)} (${pct(stats.lodWithAddr, stats.lod1)}).
- To samo dla budynków ≥ 100 m² (bez garaży i altan): ${fmt(stats.lodBigWithAddr)} z ${fmt(stats.lodBig)} (${pct(stats.lodBigWithAddr, stats.lodBig)}).
`;

// Map: LoD1 coloured by height, OSM-only buildings in magenta, streets grey, tram orange, metro stations
const S = 0.25; // px per metre
const W = (X1 - X0) * S, H = (Z1 - Z0) * S;
const px = ([x, z]) => `${((x - X0) * S).toFixed(1)},${((z - Z0) * S).toFixed(1)}`;
const color = (h) => h < 6 ? '#9ecae1' : h < 12 ? '#4292c6' : h < 20 ? '#fdae6b' : h < 35 ? '#e6550d' : '#a63603';
const path = (pts) => 'M' + pts.map(px).join('L');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" style="background:#f7f5f0;max-width:100%;height:auto">
<g fill="none" stroke="#c8c4bb" stroke-width="0.6">${streets.filter((s) => s.len > 0 && !ROAD_CLASSES[Object.keys(ROAD_CLASSES)[3]].includes(s.hw)).map((s) => `<path d="${path(s.pts)}"/>`).join('')}</g>
<g stroke="none">${lod1.map((b) => `<path d="${path(b.ring)}Z" fill="${color(b.h)}"/>`).join('')}</g>
<g fill="none" stroke="#d6007e" stroke-width="0.8">${osmBigMissing.map((b) => `<path d="${path(b.ring)}Z"/>`).join('')}</g>
<g fill="none" stroke="#f28c00" stroke-width="1">${tracks.filter((t) => t.kind === 'tram' && t.len > 0).map((t) => `<path d="${path(t.pts)}"/>`).join('')}</g>
<g font-family="system-ui,sans-serif" font-size="11">${stations.map((s) => `<circle cx="${px(s.p).split(',')[0]}" cy="${px(s.p).split(',')[1]}" r="5" fill="#c00" stroke="#fff" stroke-width="1.5"/><text x="${((s.p[0] - X0) * S + 8).toFixed(1)}" y="${((s.p[1] - Z0) * S + 4).toFixed(1)}" fill="#600" stroke="#fff" stroke-width="3" paint-order="stroke">${s.name}</text>`).join('')}</g>
</svg>`;

const mdToHtml = (s) => s.split('\n\n').map((blk) => {
  const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  if (blk.startsWith('# ')) return `<h1>${inline(blk.slice(2))}</h1>`;
  if (blk.startsWith('## ')) return `<h2>${inline(blk.slice(3))}</h2>` + (blk.includes('\n') ? mdToHtml(blk.slice(blk.indexOf('\n') + 1)) : '');
  if (blk.startsWith('### ')) return `<h3>${inline(blk.slice(4))}</h3>` + (blk.includes('\n') ? mdToHtml(blk.slice(blk.indexOf('\n') + 1)) : '');
  if (blk.startsWith('|')) {
    const rows = blk.split('\n').filter((r) => !/^\|\s*-/.test(r)).map((r) => r.slice(1, -1).split('|').map((c) => inline(c.trim())));
    return `<table><tr>${rows[0].map((c) => `<th>${c}</th>`).join('')}</tr>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  if (blk.startsWith('- ')) return `<ul>${blk.split('\n').map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
  return `<p>${inline(blk).replace(/\n/g, '<br>')}</p>`;
}).join('\n');

const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Raport 0.2 Bielany</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;color:#222;background:#fff}
table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid #ddd;padding:4px 10px;text-align:left}td:not(:first-child){text-align:right}
.legend span{display:inline-block;margin-right:14px}.legend i{display:inline-block;width:12px;height:12px;margin-right:4px;vertical-align:-1px}</style></head><body>
<h2>Mapa kontrolna</h2>
<p class="legend"><span><i style="background:#9ecae1"></i>LoD1 &lt; 6 m</span><span><i style="background:#4292c6"></i>6-12 m</span><span><i style="background:#fdae6b"></i>12-20 m</span><span><i style="background:#e6550d"></i>20-35 m</span><span><i style="background:#a63603"></i>&gt; 35 m</span><span><i style="border:2px solid #d6007e"></i>jest w OSM, brak w LoD1</span><span><i style="background:#f28c00"></i>tory tramwajowe</span><span><i style="background:#c8c4bb"></i>ulice OSM</span><span><i style="background:#c00;border-radius:50%"></i>stacje M1</span></p>
${svg}
${mdToHtml(md)}
<p style="color:#777;font-size:13px">Dane: © współtwórcy OpenStreetMap (ODbL); GUGiK, geoportal.gov.pl</p>
</body></html>`;

fs.writeFileSync(ROOT + 'docs/raport-0.2.md', md);
fs.writeFileSync(ROOT + 'docs/raport-0.2.html', html);
console.log(JSON.stringify({ ...stats, byClass: Object.fromEntries(byClass.map(([l, v]) => [l, Math.round(v)])) }, null, 1));
