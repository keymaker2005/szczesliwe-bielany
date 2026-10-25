#!/bin/sh
# Local chat Worker on http://localhost:8787 (test answers, Turnstile test keys): sh tools/czat-dev.sh
# wrangler 3.114.15 runs from a temp folder, not from the repo (wrangler 4.x breaks the Pages project)
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$REPO/worker/.dev.vars" ] || cp "$REPO/worker/.dev.vars.example" "$REPO/worker/.dev.vars"
RUN="${TMPDIR:-/tmp}/bielany-czat-wrangler"
mkdir -p "$RUN" && cd "$RUN"
exec npx --yes wrangler@3.114.15 dev --config "$REPO/worker/wrangler.toml" --port 8787 --persist-to "$REPO/worker/.wrangler/state" "$@"
