"""HTTP API for the 3rok testing globe.

``POST /api/evaluate`` takes the same config dict as ``evaluate()``.
``oem_path`` is ignored on that route so a browser cannot point the process
at an arbitrary file. Upload the CCSDS text to ``POST /api/evaluate-oem``.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from starmind_physics.chips import summarize_chips
from starmind_physics.config import load_params
from starmind_physics.evaluate import evaluate
from starmind_physics.flux import latlon_flux_grid
from starmind_physics.jsonutil import json_safe
from starmind_physics.oem import oem_to_track, parse_oem
from starmind_physics.orbit import (
    ground_track,
    orbital_elements,
    resolve_inclination_deg,
)
from starmind_physics.scripts.optimize import brute_force, pareto_front_3d

_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:43123",
    "http://127.0.0.1:43123",
]

_BLOCKED_CONFIG_KEYS = {"_params", "_chip", "oem_path"}
_MAX_OEM_BYTES = 5_000_000


def default_data_dir() -> Path:
    """Directory of committed offline demo files (``web/public/data``)."""
    env = os.environ.get("STARMIND_WEB_DATA")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / "web" / "public" / "data",
        Path.cwd() / "web" / "public" / "data",
    ]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return candidates[0]


def _read_json(path: Path) -> Any | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _public_config(config: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="config must be a JSON object")
    return {k: v for k, v in config.items() if k not in _BLOCKED_CONFIG_KEYS}


def _score(config: dict[str, Any]) -> dict[str, Any]:
    try:
        result = evaluate(config)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    body = json_safe(result)
    body["value_status"] = "derived"
    return body


def _parse_inclination(raw: str) -> str | float:
    text = raw.strip()
    if text.lower() in {"sso", "sun-synchronous", "sun_synchronous"}:
        return "sso"
    try:
        return float(text)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="inclination must be 'sso' or a number of degrees",
        ) from exc


def _track_payload(
    lat: Any,
    lon: Any,
    alt: Any,
    times: Any,
    epoch: str | None,
    *,
    source: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    import numpy as np

    lat_a = np.asarray(lat, dtype=float)
    lon_a = np.asarray(lon, dtype=float)
    times_a = np.asarray(times, dtype=float)
    if np.ndim(alt) == 0:
        alt_out: float | list[float] = float(alt)
    else:
        alt_out = [float(v) for v in np.asarray(alt, dtype=float)]
    payload: dict[str, Any] = {
        "lat_deg": [float(v) for v in lat_a],
        "lon_deg": [float(v) for v in lon_a],
        "alt_km": alt_out,
        "times_s": [float(v) for v in times_a],
        "epoch_utc": epoch,
        "source": source,
    }
    if extra:
        payload.update(extra)
    return payload


def _downsample_track(
    lat: Any,
    lon: Any,
    alt: Any,
    times: Any,
    max_points: int = 600,
) -> tuple[Any, Any, Any, Any]:
    import numpy as np

    lat_a = np.asarray(lat, dtype=float)
    n = int(lat_a.size)
    if n <= max_points:
        return lat, lon, alt, times
    idx = np.unique(np.linspace(0, n - 1, max_points).astype(int))
    alt_a = np.asarray(alt, dtype=float)
    return lat_a[idx], np.asarray(lon)[idx], alt_a[idx], np.asarray(times)[idx]


def create_app(data_dir: Path | None = None) -> FastAPI:
    """Build the API. Tests pass a temporary ``data_dir`` of fixture JSON."""
    app = FastAPI(
        title="3rok physics",
        version="0.1.0",
        summary="Ranking API for the testing globe. Not a flown lifetime.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_DEV_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.data_dir = Path(data_dir) if data_dir is not None else default_data_dir()
    app.state.eval_cache: dict[str, dict[str, Any]] = {}
    app.state.pareto_mem: dict[str, Any] | None = None
    app.state.saa_mem: dict[str, Any] | None = None

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        try:
            import aep8  # noqa: F401
        except ImportError:
            trapped = False
        else:
            trapped = True
        return {"ok": True, "aep8": trapped, "service": "starmind_physics"}

    @app.get("/api/params")
    def params() -> dict[str, Any]:
        return json_safe(load_params())

    @app.get("/api/chips")
    def chips() -> dict[str, Any]:
        return {"chips": json_safe(summarize_chips())}

    @app.post("/api/evaluate")
    def post_evaluate(config: dict[str, Any]) -> dict[str, Any]:
        public = _public_config(config)
        key = json.dumps(public, sort_keys=True, default=str)
        cached = app.state.eval_cache.get(key)
        if cached is not None:
            return cached
        scored = _score(public)
        app.state.eval_cache[key] = scored
        return scored

    @app.get("/api/track")
    def track(
        altitude_km: float = 800.0,
        inclination: str = "sso",
        n_samples: int = 360,
    ) -> dict[str, Any]:
        if not 500.0 <= altitude_km <= 2000.0:
            raise HTTPException(status_code=400, detail="altitude_km must be 500–2000")
        if not 16 <= n_samples <= 2000:
            raise HTTPException(status_code=400, detail="n_samples must be 16–2000")
        params_doc = load_params()
        inc_in = _parse_inclination(inclination)
        inc_deg = resolve_inclination_deg(inc_in, altitude_km, params_doc)
        lat, lon, times = ground_track(
            altitude_km, inc_deg, params_doc, n_samples=n_samples
        )
        els = orbital_elements(altitude_km, params_doc)
        epoch = str(params_doc["orbit_sampling"]["epoch_utc"])
        return _track_payload(
            lat,
            lon,
            altitude_km,
            times,
            epoch,
            source="ground_track",
            extra={
                "altitude_km": altitude_km,
                "inclination_deg": inc_deg,
                "period_min": float(els["period_min"]),
            },
        )

    @app.get("/api/optimize")
    def optimize() -> dict[str, Any]:
        path = app.state.data_dir / "pareto_front.json"
        stored = _read_json(path)
        if stored is not None:
            return stored
        if app.state.pareto_mem is not None:
            return app.state.pareto_mem
        rows = brute_force(3, 42)
        front = pareto_front_3d(rows)
        payload = {
            "objectives": {
                "lifetime_years": "maximize",
                "mean_power_kW": "maximize",
                "shielding_cost": "minimize (shield_mass_kg + radiator_area_m2) [A]",
            },
            "method": "brute",
            "n_evaluated": len(rows),
            "pareto_front": json_safe(front),
            "evaluated": json_safe([r for r in rows if "error" not in r]),
            "disclaimer": (
                "Ranking under stated assumptions in starmind_physics/params.yaml. "
                "Not a prediction of Starmind flight lifetime."
            ),
        }
        app.state.pareto_mem = payload
        return payload

    @app.get("/api/saa-grid")
    def saa_grid(
        altitude_km: float | None = None,
        particle: str = "p",
        solar: str = "max",
        lat_step: float | None = None,
        lon_step: float | None = None,
    ) -> dict[str, Any]:
        path = app.state.data_dir / "saa_flux_grid.json"
        stored = _read_json(path)
        wants_default = (
            altitude_km is None
            and lat_step is None
            and lon_step is None
            and particle == "p"
            and solar == "max"
        )
        if stored is not None and wants_default:
            return stored
        if stored is not None and _saa_matches(stored, altitude_km, particle, solar, lat_step, lon_step):
            return stored
        if app.state.saa_mem is not None and _saa_matches(
            app.state.saa_mem, altitude_km, particle, solar, lat_step, lon_step
        ):
            return app.state.saa_mem
        alt = 550.0 if altitude_km is None else float(altitude_km)
        step_lat = 10.0 if lat_step is None else float(lat_step)
        step_lon = 10.0 if lon_step is None else float(lon_step)
        if particle not in {"p", "e"}:
            raise HTTPException(status_code=400, detail="particle must be p or e")
        if solar not in {"min", "max"}:
            raise HTTPException(status_code=400, detail="solar must be min or max")
        try:
            grid = latlon_flux_grid(
                alt,
                load_params(),
                particle=particle,
                solar=solar,
                lat_step_deg=step_lat,
                lon_step_deg=step_lon,
            )
        except ImportError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        payload = json_safe(grid)
        app.state.saa_mem = payload
        return payload

    @app.get("/api/sensitivity")
    def sensitivity() -> dict[str, Any]:
        path = app.state.data_dir / "sensitivity.json"
        stored = _read_json(path)
        if stored is None:
            raise HTTPException(
                status_code=404,
                detail="sensitivity.json is missing. Run make data.",
            )
        return stored

    @app.post("/api/evaluate-oem")
    async def evaluate_oem(
        file: UploadFile = File(...),
        config: str = Form("{}"),
    ) -> dict[str, Any]:
        raw = await file.read()
        if len(raw) > _MAX_OEM_BYTES:
            raise HTTPException(status_code=413, detail="OEM file is over 5 MB")
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="OEM must be UTF-8 text") from exc
        try:
            parsed = parse_oem(text)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        try:
            overlay = json.loads(config) if config else {}
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="config form field must be JSON") from exc
        if not isinstance(overlay, dict):
            raise HTTPException(status_code=400, detail="config form field must be a JSON object")
        public = _public_config(overlay)
        lat, lon, alt, times, epoch = oem_to_track(parsed, step_s=30.0)
        lat_d, lon_d, alt_d, times_d = _downsample_track(lat, lon, alt, times)
        tmp_name: str | None = None
        try:
            handle = tempfile.NamedTemporaryFile(
                prefix="3rok-", suffix=".oem", delete=False
            )
            tmp_name = handle.name
            handle.write(text.encode("utf-8"))
            handle.close()
            scored = _score({**public, "oem_path": tmp_name})
        finally:
            if tmp_name:
                Path(tmp_name).unlink(missing_ok=True)
        return {
            "result": scored,
            "track": _track_payload(
                lat_d,
                lon_d,
                alt_d,
                times_d,
                str(epoch),
                source="oem",
            ),
            "disclaimer": (
                "Flux is the nanmean along this OEM window, not a full-orbit average. "
                "Eclipse, beta, and period still use altitude, inclination, and LTAN."
            ),
        }

    return app


def _saa_matches(
    grid: dict[str, Any],
    altitude_km: float | None,
    particle: str,
    solar: str,
    lat_step: float | None,
    lon_step: float | None,
) -> bool:
    if altitude_km is not None and abs(float(grid.get("altitude_km", -1)) - altitude_km) > 1.0:
        return False
    if particle and grid.get("particle") not in {None, particle}:
        return False
    if solar and grid.get("solar") not in {None, solar}:
        return False
    if lat_step is not None and grid.get("lat_step_deg") not in {None, lat_step}:
        stored = _step(grid.get("lat_deg"))
        if stored is not None and abs(stored - lat_step) > 0.1:
            return False
    if lon_step is not None and grid.get("lon_step_deg") not in {None, lon_step}:
        stored = _step(grid.get("lon_deg"))
        if stored is not None and abs(stored - lon_step) > 0.1:
            return False
    return True


def _step(values: Any) -> float | None:
    if not isinstance(values, list) or len(values) < 2:
        return None
    return abs(float(values[1]) - float(values[0]))


app = create_app()
