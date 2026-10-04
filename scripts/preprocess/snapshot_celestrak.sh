#!/usr/bin/env bash
# Snapshot CelesTrak products. The app reads these files and does not call CelesTrak.
# Usage policy (https://celestrak.org/usage-policy.php):
#   at most one download per group per 2 hours
#   on HTTP 301, 403, or 404, stop and keep the last snapshot
#   do not retry
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/data/snapshots"
mkdir -p "$DEST"

fetch_once() {
  local url="$1"
  local out="$2"
  local stamp="${out}.utc"
  local tmp="${out}.partial"
  local now code
  now="$(date -u +%s)"
  if [[ -f "$stamp" && -f "$out" ]]; then
    local prev
    prev="$(tr -cd '0-9' < "$stamp")"
    if [[ -n "$prev" ]] && (( now - prev < 7200 )); then
      echo "skip (<2h since last download): $url" >&2
      return 0
    fi
  fi
  code="$(curl --silent --show-error --output "$tmp" --write-out "%{http_code}" \
    --user-agent "starmind-nav" --max-redirs 0 "$url" || echo "000")"
  case "$code" in
    200)
      if [[ -s "$tmp" ]]; then
        mv "$tmp" "$out"
        printf '%s\n' "$now" > "$stamp"
        date -u -d "@${now}" +%Y-%m-%dT%H:%M:%SZ > "${out}.downloaded_at"
        echo "saved $out at $(cat "${out}.downloaded_at")" >&2
      else
        rm -f "$tmp"
        echo "empty body, kept previous snapshot: $url" >&2
      fi
      ;;
    301|403|404)
      rm -f "$tmp"
      echo "HTTP $code, kept previous snapshot, no retry: $url" >&2
      ;;
    *)
      rm -f "$tmp"
      echo "HTTP $code, kept previous snapshot, no retry: $url" >&2
      ;;
  esac
}

# Prefer SupGP (SpaceX-derived). GP is the fallback product, still snapshotted
# at most once per run and only as its own group request.
fetch_once "https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=json" "$DEST/celestrak_supgp.json"
fetch_once "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json" "$DEST/celestrak_gp.json"
fetch_once "https://celestrak.org/satcat/records.php?GROUP=starlink&FORMAT=json" "$DEST/celestrak_satcat.json"
fetch_once "https://celestrak.org/pub/satcat.csv" "$DEST/satcat.csv"
fetch_once "https://celestrak.org/satcat/records.php?INTDES=2022-010&FORMAT=json" "$DEST/satcat_2022-010.json"
