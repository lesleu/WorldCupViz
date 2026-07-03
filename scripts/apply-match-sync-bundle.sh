#!/usr/bin/env bash
# Copy match sync artifacts onto the current branch (no git merge).
# Bundle defaults to /tmp/wcv-match-sync (produced by npm run sync:matches).
set -euo pipefail

SYNC="${1:-/tmp/wcv-match-sync}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [[ ! -d "$SYNC/feeds" ]]; then
  echo "Missing sync bundle at $SYNC/feeds" >&2
  exit 1
fi

cp "$SYNC/sync-matches.ts" "$ROOT/scripts/sync-matches.ts"
cp "$SYNC/package.json" "$ROOT/package.json"
cp "$SYNC/schedule.generated.ts" "$ROOT/src/data/schedule.generated.ts"
cp "$SYNC/feeds.index.generated.ts" "$ROOT/src/data/feeds.index.generated.ts"
cp "$SYNC/matchAdapter.ts" "$ROOT/src/lib/matches/matchAdapter.ts"
cp "$SYNC/MatchCoverPreview.tsx" "$ROOT/src/components/MatchCoverPreview.tsx"
mkdir -p "$ROOT/src/data/feeds"
cp "$SYNC/feeds/"*.json "$ROOT/src/data/feeds/"

cd "$ROOT"
npm run sync:matches:refresh-flags
echo "Applied match sync bundle on branch $(git branch --show-current)"
