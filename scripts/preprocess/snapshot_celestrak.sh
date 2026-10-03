#!/usr/bin/env bash
# Snapshot CelesTrak products from docs/research/data-sources.md.
# The app reads these files and does not call CelesTrak live.
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/data/snapshots"
mkdir -p "$DEST"
fail=0

fetch() {
  local url="$1"
  local out="$2"
  local tmp="${out}.partial"
  if curl --fail --location --retry 5 --retry-delay 2 --retry-all-errors \
    --user-agent "starmind-nav" --output "$tmp" "$url"; then
    mv "$tmp" "$out"
  else
    rm -f "$tmp"
    echo "failed: $url" >&2
    fail=1
  fi
}

fetch "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json" "$DEST/celestrak_gp.json"
fetch "https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=json" "$DEST/celestrak_supgp.json"
fetch "https://celestrak.org/satcat/records.php?GROUP=starlink&FORMAT=json" "$DEST/celestrak_satcat.json"
fetch "https://celestrak.org/pub/satcat.csv" "$DEST/satcat.csv"
fetch "https://celestrak.org/satcat/records.php?INTDES=2022-010&FORMAT=json" "$DEST/satcat_2022-010.json"

exit "$fail"
