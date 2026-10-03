#!/usr/bin/env bash
# Start the physics API and the Vite app together.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/uvicorn ]]; then
  echo "Missing .venv. From the repo root run: make install" >&2
  exit 1
fi

if [[ ! -f lolplol/cesium-plugin/dist/index.js ]]; then
  npm run build -w @3rok/cesium-plugin
fi

.venv/bin/uvicorn starmind_physics.api:app --host 127.0.0.1 --port 8000 &
api_pid=$!
cleanup() {
  kill "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run dev -w 3rok-web
