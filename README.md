# BRHSpaceX

3rok takes chip-test data, asks Grok for a flight algorithm that keeps those chips alive longer, and saves that work so you can edit it and fly it on a globe.

This repository also ships a **testing globe** for the physics engine: a Cesium plugin, a small HTTP API, and a Vite app in the 3rok design system. The case, account, and Grok flow in [docs/mvp-phase-plan.md](docs/mvp-phase-plan.md) is a separate product surface. That plan retires an older navigator and keeps Pareto search and SAA maps off the testing page. This delivery is the engine explorer the globe task asked for: live `evaluate` scores, an SAA overlay, a Pareto chart, sensitivity, assumptions, and a guided tour. It is a ranking under stated assumptions, not a flown Starmind or Rubin lifetime.

## Pieces

| Path | Role |
|---|---|
| `starmind-physics/` | Python engine. `evaluate(config)`. Optional `api` extra is the only HTTP layer (`starmind_physics.api`). No frontend code. |
| `cesium-plugin/` | Publishable package `@3rok/cesium-plugin`. `<Globe />`, viewer hook, orbit and overlay helpers. No import of the physics package or the design system. Data and colors are props. `PhysicsClient` is the JSON contract a host implements. |
| `web/` | Integration app. Workspace dependency on the plugin, 3rok tokens and components, panels, tour, and the HTTP client. |
| `3rok-design-system/` | Tokens and component CSS. Imported once from `web/src/main.tsx`. Not forked. |

## Run

Python 3.11+ and Node 22.

```bash
make install          # venv, pip install -e "./starmind-physics[dev,api]", npm install
make data             # optional: regenerate web/public/data from the engine
make dev              # uvicorn :8000 and Vite :5173
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the physics service. Slider changes are debounced. If the API is down, the app keeps the globe up and shows the nearest precomputed score from `web/public/data`.

`make dev` is `bash scripts/dev.sh`. `make api` and `make web` start the two processes separately.

### Cesium imagery

No ion token is required. The globe uses Cesium's bundled Natural Earth II tiles, then a bare ellipsoid if those assets are missing. For Cesium ion World Imagery, set `VITE_CESIUM_ION_TOKEN` in `web/.env` (see `web/.env.example`).

## Tests

```bash
make test
```

That runs `pytest` in `starmind-physics` (API tests use FastAPI's TestClient; flux cases are marked `aep8`), then the plugin typecheck and build, then the web typecheck and production build.

Without the optional API extra, `pytest -m "not aep8"` still runs the geometry tests. The API module imports FastAPI, so install `.[dev,api]` before `tests/test_api.py`.

## Contract

The plugin README documents the JSON shapes: config in, evaluation / flux grid / Pareto out. The web client posts that config to `POST /api/evaluate`. OEM text goes to `POST /api/evaluate-oem`, not through `oem_path`.

## Assumptions worth knowing

- Inclination in the app is sun-synchronous or 30°, the envelope the ranker is built for, not a free angle.
- Interactive scores use the engine defaults, including orbit sample count. The committed Pareto file is a brute-force grid (`n_per_dim=5`, `n_samples=120` inside the search).
- The offline table is a coarse grid. A fixed radiator area or load-follow-sun falls back to the nearest constant-load point and is labeled approximate.
- `web/public/data/demo-leo.oem` is a synthetic circular 800 km SSO for the globe, not a flyable trajectory.
