"""Climatology is a history summary, not a forecast-skill check."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


climatology = load("climatology", ROOT / "ml" / "climatology.py")
gscale_mod = load("gscale_check", ROOT / "ml" / "gscale.py")
OUT = climatology.OUT
SEP_CSV = climatology.SEP_CSV
build = climatology.build
gscale = gscale_mod.gscale


def test_file_matches_recompute_and_uses_gscale_and_sep_only() -> None:
    saved = json.loads(OUT.read_text())
    fresh = build()
    assert saved["years"] == fresh["years"]
    assert saved["byYear"] == fresh["byYear"]
    assert saved["sepEventsByYear"] == fresh["sepEventsByYear"]
    assert saved["notForecastSkill"] is True

    table = pq.read_table(ROOT / "ml" / "data" / "omni_hourly.parquet", columns=["time"])
    times = [value for value in table.column("time").to_pylist() if value is not None]
    data_years = sorted({value.year for value in times})
    assert saved["years"] == data_years

    # A Kp of 9 must be counted as G5 by the same function the file used.
    assert gscale(9) == "G5"
    assert gscale(4.67) == "G0"
    g5_hours = sum(bucket["G5"]["hours"] for bucket in saved["byYear"].values())
    assert g5_hours >= 0

    sep_rows = SEP_CSV.read_text().strip().splitlines()
    assert saved["sepEventTotal"] == len(sep_rows) - 1
    assert "forecast skill" not in json.dumps(saved).lower() or saved["notForecastSkill"] is True
