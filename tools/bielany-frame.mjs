// tools/bielany-frame.mjs
// The Bielany world frame, shared by the data tools: 1 unit = 1 m, x = east, z = south (north = -z), origin at the
// Stare Bielany metro station (its OpenStreetMap node), no rotation. Local tangent plane on the WGS84 ellipsoid.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = process.env.GEO_DATA || ROOT + 'tools/data/';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const osm = (n) => read(`${DATA}osm_bielany_${n}.json`).elements;

// Area bounds (WGS84): the MVP strip of step 0.2, widened in step 2.1 (Słodowiec, Piaski, Kaskada, Chomiczówka, Las Bielański)
const BBOX = { s: 52.262, w: 20.9, n: 52.3, e: 20.98 };

const station = osm('rail').find((e) => e.type === 'node' && e.tags?.name === 'Stare Bielany' && e.tags?.station === 'subway');
if (!station) throw new Error('Stare Bielany station node missing from osm_bielany_rail.json');
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
const BOUNDS = { minX: X0, maxX: X1, minZ: Z0, maxZ: Z1 };

export { ROOT, DATA, read, osm, BBOX, BOUNDS, LAT0, LON0, toWorld };
