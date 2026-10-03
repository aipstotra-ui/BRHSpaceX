#!/usr/bin/env bash
# Download OMNI2 yearly files into ml/data/raw/.
# URL and first year are from docs/research/data-sources.md (Appendix A4).
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/ml/data/raw"
mkdir -p "$DEST"

BASE="https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni"
START=1963
END="$(date +%Y)"
fail=0

for year in $(seq "$START" "$END"); do
  out="$DEST/omni2_${year}.dat"
  if [[ -s "$out" ]]; then
    continue
  fi
  tmp="${out}.partial"
  if curl --fail --location --retry 5 --retry-delay 2 --retry-all-errors \
    --output "$tmp" "${BASE}/omni2_${year}.dat"; then
    mv "$tmp" "$out"
  else
    rm -f "$tmp"
    echo "failed: omni2_${year}.dat" >&2
    fail=1
  fi
done

exit "$fail"
