// Limits for playing with others in one place (docs/plan-fazy-5.md, decisions 2-3; contract: docs/api-gracze.md)

export const LIMITS = {
  roomSize: 30, // players per room; the next one goes to room 2, 3...
  rooms: 20, // room numbers the lobby hands out
  perAddress: 2, // connections from one address in a room (not enforced locally, for the bots)
  helloMs: 10 * 1000, // time to send "hej" after connecting
  silentMs: 10 * 1000, // a player with no message for this long is gone
  sweepMs: 2 * 1000, // how often the silent players are looked for (only when messages arrive)
  messageBytes: 512,
  ratePerSecond: 12, // token bucket: refill per second...
  rateBurst: 24, // ...and size
  droppedPerMinute: 200, // dropped messages that end a connection ("abuse")
  teleportMs: 1000, // one teleport per second
  gestureMs: 2000, // one gesture per two seconds
  renameMs: 2000, // one new name per two seconds
  reportEvery: 2000, // messages between usage reports to the lobby
  messagesPerRequest: 20, // Cloudflare bills incoming WebSocket messages 20:1
  requestsPerConnect: 4, // lobby pick + room fetch + join and leave reports
  dayRequests: 80000, // of 100 000 Durable Object requests a day on the free plan; the rest stays for the chat
  occupancyStaleMs: 2 * 60 * 1000, // a room's head count older than this is not trusted
  margin: 200, // metres outside the map a position may be
  minY: -50,
  maxY: 1500,
  maxV: 150,
};

// Map area (GEO.frame.bounds in js/bielany-geodata.js, checked by tests/gracze.test.mjs)
export const BOUNDS = { minX: -3368, maxX: 3115.4, minZ: -3246.1, maxZ: 2206.3 };

// Fastest plausible speed per mode in m/s (controllers.js: car 36 with boost, bike 19); a jump beyond
// speed * time * 1.5 + 15 m without "tp" is dropped
export const MODE_SPEED = { person: 12, cyclist: 25, car: 45, helicopter: 80 };
export const MODES = Object.keys(MODE_SPEED);

export const GESTURES = ['czesc', 'dzieki', 'jedziemy', 'brawo', 'uwaga', 'pa'];

export const RATE = { move: 5, idle: 1 }; // state messages per second the game sends (decision 3)

export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

export const MESSAGES = {
  off: 'Gra z innymi jest chwilowo wyłączona. Grasz sam.',
  resting: 'Gra z innymi odpoczywa do 2:00 w nocy (dzienny limit). Grasz sam.',
  full: 'Wszystkie pokoje są pełne. Grasz sam, spróbuj za chwilę.',
  too_many: 'Za dużo połączeń z jednego adresu.',
  forbidden: 'Gra z innymi działa tylko w grze Szczęśliwe Bielany.',
  bad_request: 'Nieprawidłowe połączenie.',
};
