#!/bin/sh
# Local server for playing with others on http://localhost:8788 (Turnstile test keys): sh tools/gracze-dev.sh
# wrangler 3.114.15 runs from a temp folder, not from the repo (wrangler 4.x breaks the Pages project)
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$REPO/worker-gracze/.dev.vars" ] || cp "$REPO/worker-gracze/.dev.vars.example" "$REPO/worker-gracze/.dev.vars"
RUN="${TMPDIR:-/tmp}/bielany-gracze-wrangler"
mkdir -p "$RUN" && cd "$RUN"
exec npx --yes wrangler@3.114.15 dev --config "$REPO/worker-gracze/wrangler.toml" --port 8788 --inspector-port 9230 --persist-to "$REPO/worker-gracze/.wrangler/state" "$@"
