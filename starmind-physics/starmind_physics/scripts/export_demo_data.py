#!/usr/bin/env python3
"""Write the offline globe files in ``web/public/data`` from the physics engine."""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from itertools import product
from pathlib import Path
from typing import Any

import numpy as np

from starmind_physics.chips import summarize_chips
from starmind_physics.config import load_params
from starmind_physics.evaluate import evaluate
from starmind_physics.flux import latlon_flux_grid
from starmind_physics.jsonutil import json_safe
from starmind_physics.oem import oem_to_track, parse_oem
from starmind_physics.orbit import orbital_elements, resolve_inclination_deg
from starmind_physics.scripts.optimize import brute_force, pareto_front_3d

BASELINE: dict[str, Any] = {
    "altitude_km": 800.0,
    "inclination": "sso",
    "ltan_hours": 6.0,
    "shield_mm_Al": 5.0,
    "radiator_area_m2": None,
    "chip_id": "google_trillium_tpu_v6e",
    "solar_phase": 1.0,
    "load_strategy": "constant",
}

DISCLAIMER = (
    "Ranking under stated assumptions in starmind_physics/params.yaml. "
    "Not a Starmind, Rubin, or flown lifetime. Values are estimated."
)


def _write(path: Path, payload: Any, *, compact: bool = False) -> None:
    text = json.dumps(json_safe(payload), indent=None if compact else 2)
    path.write_text(text, encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes)", file=sys.stderr)


def _slim(result: dict[str, Any]) -> dict[str, Any]:
    body = json_safe(result)
    body.pop("config_resolved", None)
    body["value_status"] = "derived"
    return body


def _pareto(out: Path, n_per_dim: int) -> None:
    print(f"pareto brute n_per_dim={n_per_dim}...", file=sys.stderr)
    rows = brute_force(n_per_dim, 42)
    front = pareto_front_3d(rows)
    front_out = []
    for index, row in enumerate(front, start=1):
        item = dict(row)
        item["id"] = f"P{index:02d}"
        front_out.append(item)
    _write(
        out / "pareto_front.json",
        {
            "objectives": {
                "lifetime_years": "maximize",
                "mean_power_kW": "maximize",
                "shielding_cost": "minimize (shield_mass_kg + radiator_area_m2) [A]",
            },
            "method": "brute",
            "n_per_dim": n_per_dim,
            "n_evaluated": len(rows),
            "n_errors": sum(1 for row in rows if "error" in row),
            "pareto_front": front_out,
            "evaluated": [row for row in rows if "error" not in row],
            "disclaimer": DISCLAIMER,
        },
    )


def _saa(out: Path, step: float) -> None:
    print(f"saa grid step={step}...", file=sys.stderr)
    params = load_params()
    grid = latlon_flux_grid(
        550.0,
        params,
        particle="p",
        solar="max",
        lat_step_deg=step,
        lon_step_deg=step,
    )
    grid["lat_step_deg"] = step
    grid["lon_step_deg"] = step
    lats = grid["lat_deg"]
    lons = grid["lon_deg"]
    flux = grid["flux_cm2_s"]
    i = min(range(len(lats)), key=lambda k: abs(lats[k] - (-30.0)))
    j = min(range(len(lons)), key=lambda k: abs(lons[k] - (-45.0)))
    grid["saa_sample"] = {
        "lat_deg": lats[i],
        "lon_deg": lons[j],
        "flux_cm2_s": flux[i][j],
        "note": "Near (-30, -45). Protons >10 MeV are elevated in the South Atlantic Anomaly.",
    }
    _write(out / "saa_flux_grid.json", grid)


def _sensitivity(out: Path, baseline_result: dict[str, Any]) -> None:
    base_life = baseline_result.get("lifetime_years") or 0.0
    cases = [
        ("shield +3 mm Al", {**BASELINE, "shield_mm_Al": 8.0}),
        ("chip → rad-hard anchor", {**BASELINE, "chip_id": "bae_rad750"}),
        ("altitude +200 km", {**BASELINE, "altitude_km": 1000.0}),
        ("inclination → 30°", {**BASELINE, "inclination": 30.0}),
        ("shield −3 mm Al", {**BASELINE, "shield_mm_Al": 2.0}),
        ("altitude −200 km", {**BASELINE, "altitude_km": 600.0}),
        ("LTAN → 12 h", {**BASELINE, "ltan_hours": 12.0}),
        ("load follow sun", {**BASELINE, "load_strategy": "load_follow_sun"}),
    ]
    bars = []
    for label, cfg in cases:
        result = evaluate(cfg)
        life = result["lifetime_years"]
        delta = None if life is None or base_life is None else float(life) - float(base_life)
        relative = None
        if delta is not None and base_life:
            relative = delta / float(base_life)
        bars.append(
            {
                "label": label,
                "lifetime_years": life,
                "delta_years": delta,
                "relative_change": relative,
                "limiting_mode": result["limiting_mode"],
            }
        )
    bars.sort(key=lambda row: abs(row["delta_years"] or 0.0), reverse=True)
    _write(
        out / "sensitivity.json",
        {
            "baseline": {
                "config": BASELINE,
                "lifetime_years": baseline_result.get("lifetime_years"),
                "mean_power_kW": baseline_result.get("mean_power_kW"),
                "limiting_mode": baseline_result.get("limiting_mode"),
                "breakdown": baseline_result.get("breakdown"),
            },
            "bars": bars,
            "disclaimer": DISCLAIMER,
        },
    )


def _offline_grid(out: Path) -> None:
    altitudes = [500.0, 800.0, 1200.0, 1600.0, 2000.0]
    inclinations: list[Any] = ["sso", 30.0]
    ltans = [0.0, 6.0, 12.0]
    shields = [1.0, 5.0, 10.0, 15.0]
    phases = [0.0, 0.5, 1.0]
    presets = ["commercial", "rad_hard"]
    points = []
    combos = list(product(altitudes, inclinations, ltans, shields, phases, presets))
    print(f"offline grid {len(combos)} evaluations...", file=sys.stderr)
    for index, (alt, inc, ltan, shield, phase, preset) in enumerate(combos, start=1):
        cfg = {
            "altitude_km": alt,
            "inclination": inc,
            "ltan_hours": ltan,
            "shield_mm_Al": shield,
            "solar_phase": phase,
            "chip_preset": preset,
            "load_strategy": "constant",
            "radiator_area_m2": None,
        }
        try:
            result = _slim(evaluate(cfg))
        except Exception as exc:  # noqa: BLE001 — keep the table usable
            result = {"error": str(exc)}
        points.append({"config": cfg, "result": result})
        if index % 100 == 0:
            print(f"  {index}/{len(combos)}", file=sys.stderr)
    _write(
        out / "offline_grid.json",
        {
            "axes": {
                "altitude_km": altitudes,
                "inclination": inclinations,
                "ltan_hours": ltans,
                "shield_mm_Al": shields,
                "solar_phase": phases,
                "chip_preset": presets,
            },
            "points": points,
            "disclaimer": (
                DISCLAIMER
                + " Nearest grid point when the API is unreachable. "
                "Fixed radiator area and load-follow-sun are not in this table."
            ),
        },
        compact=True,
    )


def _demo_oem(out: Path) -> None:
    """Two revolutions of a circular 800 km SSO, inertial GCRF, for the globe demo."""
    params = load_params()
    altitude_km = 800.0
    inc = resolve_inclination_deg("sso", altitude_km, params)
    els = orbital_elements(altitude_km, params)
    a = els["a_km"]
    n = els["n_rad_s"]
    i = math.radians(inc)
    step_s = 60.0
    duration_s = 2.0 * els["period_s"]
    t0 = datetime(2026, 10, 3, 12, 0, 0, tzinfo=timezone.utc)
    times = np.arange(0.0, duration_s + 1e-6, step_s)
    rows = []
    for t in times:
        theta = n * float(t)
        x = a * math.cos(theta)
        y = a * math.sin(theta) * math.cos(i)
        z = a * math.sin(theta) * math.sin(i)
        vx = -a * n * math.sin(theta)
        vy = a * n * math.cos(theta) * math.cos(i)
        vz = a * n * math.cos(theta) * math.sin(i)
        stamp = (t0 + timedelta(seconds=float(t))).strftime("%Y-%m-%dT%H:%M:%S.000")
        rows.append(
            f"{stamp}  {x:.6f}  {y:.6f}  {z:.6f}  {vx:.6f}  {vy:.6f}  {vz:.6f}"
        )
    start = rows[0].split()[0]
    stop = rows[-1].split()[0]
    text = "\n".join(
        [
            "CCSDS_OEM_VERS = 3.0",
            "CREATION_DATE = 2026-10-03T12:00:00",
            "ORIGINATOR = 3ROK",
            "COMMENT Synthetic circular 800 km SSO for the testing globe. Not a flyable trajectory.",
            "META_START",
            "OBJECT_NAME = DEMO-LEO",
            "OBJECT_ID = 2026-DEMO",
            "CENTER_NAME = EARTH",
            "REF_FRAME = GCRF",
            "TIME_SYSTEM = UTC",
            f"START_TIME = {start}",
            f"STOP_TIME = {stop}",
            "META_STOP",
            *rows,
            "",
        ]
    )
    path = out / "demo-leo.oem"
    path.write_text(text, encoding="utf-8")
    lat, _lon, alt, _tt, _epoch = oem_to_track(parse_oem(text), step_s=120.0)
    if float(np.nanmean(alt)) < 700.0 or float(np.nanmax(np.abs(lat))) > 90.0:
        raise RuntimeError("demo OEM geodetic track failed a sanity check")
    print(f"wrote {path} ({len(rows)} states, mean alt {float(np.mean(alt)):.1f} km)", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--n-per-dim", type=int, default=5)
    parser.add_argument("--saa-step", type=float, default=5.0)
    parser.add_argument("--skip-grid", action="store_true")
    args = parser.parse_args(argv)
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    print("baseline evaluate...", file=sys.stderr)
    baseline = _slim(evaluate(BASELINE))
    _write(out / "baseline.json", {"config": BASELINE, "result": baseline, "disclaimer": DISCLAIMER})
    _sensitivity(out, baseline)
    _pareto(out, args.n_per_dim)
    _saa(out, args.saa_step)
    _write(out / "chips.json", {"chips": summarize_chips()})
    _write(out / "params.json", load_params())
    _demo_oem(out)
    if not args.skip_grid:
        _offline_grid(out)
    print("demo data ready", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
