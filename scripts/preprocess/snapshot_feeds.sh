#!/usr/bin/env bash
# Snapshot SWPC feeds listed in docs/research/api-swpc.md, plus live F10.7.
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

fetch "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json" "$DEST/kp.json"
fetch "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json" "$DEST/kp_1m.json"
fetch "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json" "$DEST/kp_forecast.json"
fetch "https://services.swpc.noaa.gov/products/noaa-scales.json" "$DEST/scales.json"
fetch "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json" "$DEST/goes_protons.json"
fetch "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json" "$DEST/goes_xrays.json"
fetch "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json" "$DEST/rtsw_wind_1m.json"
fetch "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json" "$DEST/rtsw_mag_1m.json"
fetch "https://services.swpc.noaa.gov/products/kyoto-dst.json" "$DEST/dst.json"
fetch "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json" "$DEST/aurora.json"
fetch "https://services.swpc.noaa.gov/json/f107_cm_flux.json" "$DEST/f107.json"

tmp="$DEST/forecast_3day.txt.partial"
if curl --fail --location --retry 5 --retry-delay 2 --retry-all-errors \
  --user-agent "starmind-nav" --output "$tmp" \
  "https://services.swpc.noaa.gov/text/3-day-forecast.txt"; then
  python3 - "$tmp" "$DEST/forecast_3day.json" << 'PY'
import json
import pathlib
import sys
src, dest = sys.argv[1:]
pathlib.Path(dest).write_text(json.dumps({"text": pathlib.Path(src).read_text()}))
PY
  rm -f "$tmp"
else
  rm -f "$tmp"
  echo "failed: 3-day forecast" >&2
  fail=1
fi

exit "$fail"
